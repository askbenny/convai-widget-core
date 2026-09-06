import { SessionConfig, AudioWorkletConfig } from "@elevenlabs/client";
import { ReadonlySignal, useComputed, useSignal } from "@preact/signals";
import { ComponentChildren } from "preact";
import { createContext } from "preact/compat";
import { useEffect, useMemo, useRef } from "preact/hooks";
import { useAttribute } from "./attributes";
import { useLanguageConfig } from "./language-config";
import { useContextSafely } from "../utils/useContextSafely";
import { parseBoolAttribute } from "../types/attributes";
import { useTextOnly } from "./widget-config";
import {
  applyManagedSession,
  fetchWidgetConfig,
  fetchWidgetSession,
  PublicAgentConfig,
} from "../utils/managed-session";

type DynamicVariables = Record<string, string | number | boolean>;
const SessionConfigContext = createContext<{
  config: ReadonlySignal<SessionConfig>;
  prepare: (config: SessionConfig) => Promise<SessionConfig>;
  cancel: () => void;
  guard: () => () => boolean;
  presentation: ReadonlySignal<PublicAgentConfig | null>;
} | null>(null);

export function SessionConfigProvider({ children }: { children: ComponentChildren }) {
  const { language } = useLanguageConfig();
  const overrideSpeed = useAttribute("override-speed");
  const overrideStability = useAttribute("override-stability");
  const overrideSimilarityBoost = useAttribute("override-similarity-boost");
  const overrideFirstMessage = useAttribute("override-first-message");
  const overrideVoiceId = useAttribute("override-voice-id");
  const overrideTextOnly = useAttribute("override-text-only");
  const userId = useAttribute("user-id");
  const agentId = useAttribute("agent-id");
  const signedUrl = useAttribute("signed-url");
  const environment = useAttribute("environment");
  const textOnly = useTextOnly();
  const fetched = useSignal<PublicAgentConfig | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const presentationRequestRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);
  const generationRef = useRef(0);
  const dynamicVariablesJSON = useAttribute("dynamic-variables");
  const dynamicVariables = useComputed(() => {
    try {
      const value = JSON.parse(dynamicVariablesJSON.value || "{}");
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as DynamicVariables)
        : {};
    } catch {
      return {};
    }
  });
  const rawAudioProcessor = useAttribute("worklet-path-raw-audio-processor");
  const audioConcatProcessor = useAttribute("worklet-path-audio-concat-processor");
  const libsamplerate = useAttribute("worklet-path-libsamplerate");

  useEffect(() => {
    fetched.value = null;
    const controller = new AbortController();
    presentationRequestRef.current = controller;
    if (agentId.value && !signedUrl.value) {
      fetchWidgetConfig(agentId.value, environment.value, controller.signal)
        .then((config) => {
          if (!controller.signal.aborted) fetched.value = config;
        })
        .catch(() => {
          /* Session start retries; a loading failure must not hide the widget. */
        });
    }
    return () => {
      controller.abort();
      requestRef.current?.abort();
    };
  }, [agentId.value, environment.value, signedUrl.value]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      requestRef.current?.abort();
    };
  }, []);

  const config = useComputed<SessionConfig>(
    () =>
      ({
        // A placeholder is never passed to the SDK: prepare obtains the session at start.
        signedUrl: signedUrl.value || "",
        connectionType: "websocket",
        dynamicVariables: dynamicVariables.value,
        overrides: {
          agent: {
            firstMessage: overrideFirstMessage.value,
            language: language.value.languageCode,
          },
          tts: {
            voiceId: overrideVoiceId.value,
            speed: overrideSpeed.value ? parseFloat(overrideSpeed.value) : undefined,
            stability: overrideStability.value ? parseFloat(overrideStability.value) : undefined,
            similarityBoost: overrideSimilarityBoost.value
              ? parseFloat(overrideSimilarityBoost.value)
              : undefined,
          },
          conversation: {
            textOnly:
              fetched.value?.conversation?.textOnly ||
              (parseBoolAttribute(overrideTextOnly.value) ?? undefined),
          },
        },
        connectionDelay: { default: 300 },
        textOnly: fetched.value?.conversation?.textOnly || textOnly.value,
        userId: userId.value || undefined,
        libsampleratePath: libsamplerate.value,
        workletPaths: {
          rawAudioProcessor: rawAudioProcessor.value,
          audioConcatProcessor: audioConcatProcessor.value,
        },
      }) satisfies SessionConfig & Partial<AudioWorkletConfig>
  );

  const value = useMemo(
    () => ({
      config,
      presentation: fetched,
      cancel: () => {
        generationRef.current++;
        requestRef.current?.abort();
      },
      guard: () => {
        const generation = generationRef.current;
        const id = agentId.peek();
        const env = environment.peek();
        const url = signedUrl.peek();
        return () =>
          aliveRef.current &&
          generation === generationRef.current &&
          id === agentId.peek() &&
          env === environment.peek() &&
          url === signedUrl.peek();
      },
      prepare: async (requested: SessionConfig): Promise<SessionConfig> => {
        const id = agentId.peek();
        const env = environment.peek();
        const explicitUrl = signedUrl.peek();
        if (!aliveRef.current) throw new Error("Conversation cancelled.");
        // Explicit signed sessions remain supported for callers owning session acquisition.
        if (explicitUrl)
          return {
            ...requested,
            agentId: undefined,
            conversationToken: undefined,
            signedUrl: explicitUrl,
            connectionType: "websocket",
          };
        if (!id) throw new Error("A website assistant is required.");
        const controller = new AbortController();
        requestRef.current?.abort();
        requestRef.current = controller;
        const session = await fetchWidgetSession(id, env, controller.signal);
        if (
          controller.signal.aborted ||
          !aliveRef.current ||
          id !== agentId.peek() ||
          env !== environment.peek() ||
          signedUrl.peek() !== explicitUrl
        )
          throw new Error("Conversation cancelled.");
        // Signing is fresher than the optional initial presentation request. Repair
        // its failure and prevent a late response from restoring an older greeting.
        presentationRequestRef.current?.abort();
        fetched.value = {
          schemaVersion: session.schemaVersion,
          agentId: session.agentId,
          branchId: session.branchId,
          demo: session.demo,
          agent: session.agent,
          tts: session.tts,
          conversation: session.conversation,
        };
        return applyManagedSession(requested, session);
      },
    }),
    [config, agentId, environment, signedUrl]
  );

  return <SessionConfigContext.Provider value={value}>{children}</SessionConfigContext.Provider>;
}
export function useSessionConfig() {
  return useContextSafely(SessionConfigContext).config;
}
export function useSessionPreparation() {
  return useContextSafely(SessionConfigContext);
}

export function useSessionPresentation() {
  return useContextSafely(SessionConfigContext).presentation;
}
