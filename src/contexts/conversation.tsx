import { Conversation, Mode, Role, SessionConfig, Status } from "@elevenlabs/client";
import { computed, signal, useSignalEffect } from "@preact/signals";
import { ComponentChildren } from "preact";
import { createContext, useMemo } from "preact/compat";
import { useEffect, useRef } from "react";
import { useSessionConfig, useSessionPreparation } from "./session-config";

import { useContextSafely } from "../utils/useContextSafely";
import { useTerms } from "./terms";
import { useFirstMessage, useWidgetConfig } from "./widget-config";
import { ConversationMode } from "./conversation-mode";
import { useShadowHost } from "./shadow-host";

const FIRST_MESSAGE_EVENT_ID = 1;

type AgentEventId = number | undefined;

type AgentStream = {
  kind: "stream";
  index: number;
  eventId: AgentEventId;
};

type IgnoredAgentStream = {
  kind: "ignored";
  eventId: AgentEventId;
};

type AgentResponsePointer = {
  index: number;
  eventId: AgentEventId;
  message: string;
};

type AgentStreamState = {
  pending: AgentStream[];
  active: AgentStream | IgnoredAgentStream | null;
  unmatchedResponse: AgentResponsePointer | null;
  ignoredResponse: { eventId: AgentEventId; message: string } | null;
};

function createAgentStreamState(): AgentStreamState {
  return {
    pending: [],
    active: null,
    unmatchedResponse: null,
    ignoredResponse: null,
  };
}

// TODO: drop once the backend stops stripping `*` and `##+` out of
// `agent_response` but not `agent_chat_response_part`.
function stripSpokenMarkdown(text: string): string {
  return text.replace(/\*+/g, "").replace(/#{2,}/g, "");
}

function isSameAgentText(streamed: string, final: string): boolean {
  return stripSpokenMarkdown(streamed) === stripSpokenMarkdown(final);
}

function findPendingStream(
  transcript: TranscriptEntry[],
  state: AgentStreamState,
  eventId: AgentEventId,
  message: string
): AgentStream | undefined {
  const strippedMessage = stripSpokenMarkdown(message);
  const candidates = state.pending.filter((stream) => {
    if (stream.eventId !== eventId) return false;
    const entry = transcript[stream.index];
    return entry?.type === "message" && entry.role === "agent" && entry.eventId === eventId;
  });
  const textAt = (stream: AgentStream) => {
    const entry = transcript[stream.index];
    return entry?.type === "message" ? entry.message : "";
  };
  const streamed = candidates.filter((stream) => textAt(stream).trim()).reverse();
  const active = state.active;
  const activeStreamed =
    active?.kind === "stream" && candidates.includes(active) && textAt(active) ? active : undefined;

  return (
    candidates.find((stream) => isSameAgentText(textAt(stream), message)) ??
    streamed.find((stream) => strippedMessage.startsWith(stripSpokenMarkdown(textAt(stream)))) ??
    activeStreamed ??
    candidates.find((stream) => !textAt(stream).trim()) ??
    candidates[0]
  );
}

type ConversationSetup = ReturnType<typeof useConversationSetup>;

export const ConversationContext = createContext<ConversationSetup | null>(null);

interface ConversationProviderProps {
  children: ComponentChildren;
}

export type TranscriptEntry =
  | {
      type: "message";
      role: Role;
      message: string;
      isText: boolean;
      conversationIndex: number;
      eventId?: number;
    }
  | {
      type: "agent_tool_request";
      toolName: string;
      toolCallId: string;
      eventId: number;
      conversationIndex: number;
    }
  | {
      type: "agent_tool_response";
      toolCallId: string;
      eventId: number;
      isError: boolean;
      conversationIndex: number;
    }
  | {
      type: "disconnection";
      role: Role;
      message?: undefined;
      conversationIndex: number;
    }
  | {
      type: "error";
      message: string;
      conversationIndex: number;
    }
  | {
      type: "mode_toggle";
      mode: ConversationMode;
      conversationIndex: number;
    };

export function ConversationProvider({ children }: ConversationProviderProps) {
  const value = useConversationSetup();

  // Automatically disconnect the conversation after 10 minutes of no messages
  useSignalEffect(() => {
    if (value.conversationTextOnly.value === true) {
      value.transcript.value;
      const id = setTimeout(
        () => {
          value.endSession();
        },
        10 * 60 * 1000 // 10 minutes
      );
      return () => {
        clearTimeout(id);
      };
    }
  });

  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export function useConversation() {
  return useContextSafely(ConversationContext);
}

function useConversationSetup() {
  const conversationRef = useRef<Conversation | null>(null);
  const lockRef = useRef<Promise<Conversation> | null>(null);
  const agentStreamStateRef = useRef(createAgentStreamState());
  const shadowHost = useShadowHost();

  const widgetConfig = useWidgetConfig();
  const firstMessage = useFirstMessage();
  const terms = useTerms();
  const config = useSessionConfig();
  const { prepare, cancel, guard } = useSessionPreparation();
  const startRef = useRef<Promise<string | undefined> | null>(null);

  // Stop the conversation when the component unmounts.
  // This can happen when the widget is used inside another framework.
  useEffect(() => {
    return () => {
      cancel();
      conversationRef.current?.endSession();
    };
  }, []);

  return useMemo(() => {
    const status = signal<Status>("disconnected");
    const isDisconnected = computed(() => status.value === "disconnected");

    const mode = signal<Mode>("listening");
    const isSpeaking = computed(() => mode.value === "speaking");

    const error = signal<string | null>(null);
    const lastId = signal<string | null>(null);
    const canSendFeedback = signal(false);
    const transcript = signal<TranscriptEntry[]>([]);
    const conversationIndex = signal(0);
    const conversationTextOnly = signal<boolean | null>(null);

    return {
      status,
      isSpeaking,
      mode,
      isDisconnected,
      lastId,
      error,
      canSendFeedback,
      conversationIndex,
      conversationTextOnly,
      transcript,
      startSession: (element: HTMLElement, initialMessage?: string) => {
        if (startRef.current) return startRef.current;
        const isCurrent = guard();
        const start = async () => {
          await terms.requestTerms();
          if (!isCurrent()) return undefined;

          if (conversationRef.current?.isOpen()) {
            return conversationRef.current.getId();
          }

          if (lockRef.current) {
            const conversation = await lockRef.current;
            return conversation.getId();
          }

          let processedConfig = structuredClone(config.peek());
          // If the user started the conversation with a text message, and the
          // agent supports it, switch to text-only mode.
          if (initialMessage && widgetConfig.value.supports_text_only) {
            processedConfig.textOnly = true;
            if (!widgetConfig.value.text_only) {
              processedConfig.overrides ??= {};
              processedConfig.overrides.conversation ??= {};
              processedConfig.overrides.conversation.textOnly = true;
            }
          }

          try {
            processedConfig = triggerCallEvent(shadowHost.value ?? element, processedConfig);
          } catch (error) {
            console.error("[ConversationalAI] Error triggering call event:", error);
          }

          agentStreamStateRef.current = createAgentStreamState();
          conversationTextOnly.value = processedConfig.textOnly ?? false;
          transcript.value = initialMessage
            ? [
                {
                  type: "message",
                  role: "user",
                  message: initialMessage,
                  isText: true,
                  conversationIndex: conversationIndex.peek(),
                },
              ]
            : [];

          try {
            status.value = "connecting";
            processedConfig = await prepare(processedConfig);
            if (!isCurrent()) throw new Error("Conversation cancelled.");
            conversationTextOnly.value = processedConfig.textOnly ?? false;
            lockRef.current = Conversation.startSession({
              ...processedConfig,
              onModeChange: (props) => {
                mode.value = props.mode;
              },
              onStatusChange: (props) => {
                status.value = props.status;
              },
              onCanSendFeedbackChange: (props) => {
                canSendFeedback.value = props.canSendFeedback;
              },
              onMessage: ({ role, message, event_id }) => {
                if (
                  firstMessage.peek() &&
                  conversationTextOnly.peek() === true &&
                  role === "agent" &&
                  event_id === FIRST_MESSAGE_EVENT_ID
                ) {
                  // The configured first message is already rendered locally in
                  // text mode, so ignore the server copy.
                  return;
                }

                if (role === "agent") {
                  const currentTranscript = transcript.peek();
                  const streamState = agentStreamStateRef.current;

                  const ignoredResponse = streamState.ignoredResponse;
                  if (
                    ignoredResponse &&
                    ignoredResponse.eventId === event_id &&
                    ignoredResponse.message === message
                  ) {
                    streamState.ignoredResponse = null;
                    return;
                  }

                  const streamingMessage = findPendingStream(
                    currentTranscript,
                    streamState,
                    event_id,
                    message
                  );

                  if (streamingMessage) {
                    const streamedEntry = currentTranscript[streamingMessage.index];
                    const streamedText =
                      streamedEntry?.type === "message" ? streamedEntry.message : "";
                    const updatedTranscript = [...currentTranscript];
                    updatedTranscript[streamingMessage.index] = {
                      type: "message",
                      role: "agent",
                      // Only the streamed copy still carries the formatting.
                      message: isSameAgentText(streamedText, message) ? streamedText : message,
                      isText: conversationTextOnly.peek() === true,
                      conversationIndex: conversationIndex.peek(),
                      eventId: event_id,
                    };
                    transcript.value = updatedTranscript;
                    streamState.pending = streamState.pending.filter(
                      (stream) => stream !== streamingMessage
                    );
                    if (streamState.active === streamingMessage) {
                      streamState.active = null;
                    }
                    return;
                  }
                }

                const currentTranscript = transcript.peek();
                transcript.value = [
                  ...currentTranscript,
                  {
                    type: "message",
                    role,
                    message,
                    isText: conversationTextOnly.peek() === true,
                    conversationIndex: conversationIndex.peek(),
                    eventId: event_id,
                  },
                ];
                if (role === "agent") {
                  agentStreamStateRef.current.unmatchedResponse = {
                    index: currentTranscript.length,
                    eventId: event_id,
                    message,
                  };
                }
              },
              onAgentChatResponsePart: ({ text, type, event_id }) => {
                // Voice conversations render `agent_response` transcripts only.
                if (conversationTextOnly.peek() !== true) return;

                // Only event 1 is the configured greeting. Never discard the first
                // actual reply when the server omits that greeting after interruption.
                if (firstMessage.peek() && event_id === FIRST_MESSAGE_EVENT_ID) return;

                if (type === "start") {
                  const currentTranscript = transcript.peek();
                  const streamState = agentStreamStateRef.current;
                  const unmatchedResponse = streamState.unmatchedResponse;
                  const unmatchedEntry =
                    unmatchedResponse == null
                      ? undefined
                      : currentTranscript[unmatchedResponse.index];
                  if (
                    unmatchedResponse &&
                    unmatchedResponse.eventId === event_id &&
                    unmatchedResponse.index === currentTranscript.length - 1 &&
                    unmatchedEntry?.type === "message" &&
                    unmatchedEntry.role === "agent" &&
                    unmatchedEntry.message.trim() !== ""
                  ) {
                    streamState.unmatchedResponse = null;
                    streamState.active = { kind: "ignored", eventId: event_id };
                    streamState.ignoredResponse = {
                      eventId: event_id,
                      message: unmatchedResponse.message,
                    };
                    return;
                  }

                  const stream: AgentStream = {
                    kind: "stream",
                    index: currentTranscript.length,
                    eventId: event_id,
                  };
                  streamState.ignoredResponse = null;
                  streamState.pending.push(stream);
                  streamState.active = stream;
                  transcript.value = [
                    ...currentTranscript,
                    {
                      type: "message",
                      role: "agent",
                      message: "",
                      isText: conversationTextOnly.peek() === true,
                      conversationIndex: conversationIndex.peek(),
                      eventId: event_id,
                    },
                  ];
                } else if (type === "delta") {
                  const activeStream = agentStreamStateRef.current.active;
                  if (
                    activeStream &&
                    activeStream.kind === "stream" &&
                    activeStream.eventId === event_id &&
                    text
                  ) {
                    const currentTranscript = transcript.peek();
                    const entry = currentTranscript[activeStream.index];
                    if (
                      entry?.type === "message" &&
                      entry.role === "agent" &&
                      entry.eventId === event_id
                    ) {
                      const updatedTranscript = [...currentTranscript];
                      updatedTranscript[activeStream.index] = {
                        ...entry,
                        message: entry.message + text,
                      };
                      transcript.value = updatedTranscript;
                    }
                  }
                } else if (type === "stop") {
                  const streamState = agentStreamStateRef.current;
                  if (streamState.active?.eventId === event_id) {
                    streamState.active = null;
                  }
                }
              },
              onAgentToolRequest: ({ tool_call_id, tool_name, event_id }) => {
                transcript.value = [
                  ...transcript.peek(),
                  {
                    type: "agent_tool_request",
                    toolName: tool_name,
                    toolCallId: tool_call_id,
                    eventId: event_id,
                    conversationIndex: conversationIndex.peek(),
                  },
                ];
              },
              onAgentToolResponse: ({ tool_call_id, is_error, event_id }) => {
                transcript.value = [
                  ...transcript.peek(),
                  {
                    type: "agent_tool_response",
                    toolCallId: tool_call_id,
                    eventId: event_id,
                    isError: is_error,
                    conversationIndex: conversationIndex.peek(),
                  },
                ];
              },
              onDisconnect: (details) => {
                conversationTextOnly.value = null;
                agentStreamStateRef.current = createAgentStreamState();
                transcript.value = [
                  ...transcript.peek(),
                  details.reason === "error"
                    ? {
                        type: "error",
                        message: details.message,
                        conversationIndex: conversationIndex.peek(),
                      }
                    : {
                        type: "disconnection",
                        role: details.reason === "user" ? "user" : "agent",
                        conversationIndex: conversationIndex.peek(),
                      },
                ];
                conversationIndex.value++;
                if (details.reason === "error") {
                  error.value = details.message;
                  console.error(
                    "[ConversationalAI] Disconnected due to an error:",
                    details.message
                  );
                }
              },
            });

            const connected = await lockRef.current;
            if (!isCurrent()) {
              await connected.endSession();
              throw new Error("Conversation cancelled.");
            }
            conversationRef.current = connected;
            if (initialMessage) {
              const instance = conversationRef.current;
              // TODO: Remove the delay once BE can handle it
              setTimeout(() => instance.sendUserMessage(initialMessage), 100);
            }

            const id = conversationRef.current.getId();
            lastId.value = id;
            error.value = null;
            return id;
          } catch (e) {
            // Agent changes, explicit end and unmount intentionally invalidate this start.
            if (!isCurrent()) return undefined;
            let message = "Could not start a conversation.";
            if (e instanceof CloseEvent) {
              message = e.reason || message;
            } else if (e instanceof Error) {
              message = e.message || message;
            }
            error.value = message;
            transcript.value = [
              ...transcript.value,
              {
                type: "error",
                message,
                conversationIndex: conversationIndex.peek(),
              },
            ];
          } finally {
            lockRef.current = null;
            if (!conversationRef.current?.isOpen()) status.value = "disconnected";
          }
        };
        startRef.current = start().finally(() => {
          startRef.current = null;
        });
        return startRef.current;
      },
      endSession: async () => {
        cancel();
        const conversation = conversationRef.current;
        conversationRef.current = null;
        await conversation?.endSession();
      },
      getInputVolume: () => {
        return conversationRef.current?.getInputVolume() ?? 0;
      },
      getOutputVolume: () => {
        return conversationRef.current?.getOutputVolume() ?? 0;
      },
      setVolume: (volume: number) => {
        conversationRef.current?.setVolume({ volume });
      },
      setMicMuted: (muted: boolean) => {
        conversationRef.current?.setMicMuted(muted);
      },
      sendFeedback: (like: boolean) => {
        conversationRef.current?.sendFeedback(like);
      },
      sendUserMessage: (text: string) => {
        conversationRef.current?.sendUserMessage(text);
        transcript.value = [
          ...transcript.value,
          {
            type: "message",
            role: "user",
            message: text,
            isText: true,
            conversationIndex: conversationIndex.peek(),
          },
        ];
      },
      sendUserActivity: () => {
        conversationRef.current?.sendUserActivity();
      },
      addModeToggleEntry: (mode: ConversationMode) => {
        // Only add entry if conversation is active
        if (!conversationRef.current?.isOpen()) return;
        transcript.value = [
          ...transcript.value,
          {
            type: "mode_toggle",
            mode,
            conversationIndex: conversationIndex.peek(),
          },
        ];
      },
    };
  }, [config, prepare, cancel, guard]);
}

function triggerCallEvent(element: HTMLElement, config: SessionConfig): SessionConfig {
  try {
    const event = new CustomEvent("elevenlabs-convai:call", {
      bubbles: true,
      composed: true,
      detail: { config },
    });
    element.dispatchEvent(event);
    return event.detail.config;
  } catch (e) {
    console.error("[ConversationalAI] Could not trigger call event:", e);
    return config;
  }
}
