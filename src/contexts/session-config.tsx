import { Language, SessionConfig, AudioWorkletConfig } from "@elevenlabs/client";
import { ReadonlySignal, useComputed, useSignal } from "@preact/signals";
import { ComponentChildren } from "preact";
import { createContext } from "preact/compat";
import { useAttribute } from "./attributes";
import { useLanguageConfig } from "./language-config";
import { useServerLocation } from "./server-location";
import { useEffect } from "preact/hooks";

import { useContextSafely } from "../utils/useContextSafely";
import { parseBoolAttribute } from "../types/attributes";
import { useTextOnly, useWebRTC } from "./widget-config";
import { websiteWidgetUrl } from "../utils/website-widget-api";

type DynamicVariables = Record<string, string | number | boolean>;

interface AgentConfig {
  agent?: {
    prompt?: {
      prompt?: string;
    };
    firstMessage?: string;
    language?: Language;
  };
  tts?: {
    voiceId?: string;
  };
  conversation?: {
    textOnly?: boolean;
  };
}

// Add function to fetch signed URL
async function fetchSignedUrl(agentId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.askbenny.ca/elevenlabs/signed-url?agentId=${agentId}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.body?.signedUrl || null;
  } catch (error) {
    console.error("[ConversationalAI] Failed to fetch signed URL:", error);
    return null;
  }
}

// Add function to fetch agent config
async function fetchAgentConfig(agentId: string): Promise<AgentConfig | null> {
  try {
    const response = await fetch(
      `https://api.askbenny.ca/elevenlabs/agents/config?agentId=${agentId}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.body || null;
  } catch (error) {
    console.error("[ConversationalAI] Failed to fetch agent config:", error);
    return null;
  }
}

const SessionConfigContext = createContext<ReadonlySignal<SessionConfig> | null>(null);
const SessionResolverContext = createContext<
  ((config: SessionConfig) => Promise<SessionConfig>) | null
>(null);

interface SessionConfigProviderProps {
  children: ComponentChildren;
}

export function SessionConfigProvider({ children }: SessionConfigProviderProps) {
  const { language } = useLanguageConfig();
  const overridePrompt = useAttribute("override-prompt");
  const overrideLLM = useAttribute("override-llm");
  const overrideSpeed = useAttribute("override-speed");
  const overrideStability = useAttribute("override-stability");
  const overrideSimilarityBoost = useAttribute("override-similarity-boost");
  const overrideFirstMessage = useAttribute("override-first-message");
  const overrideVoiceId = useAttribute("override-voice-id");
  const overrideTextOnly = useAttribute("override-text-only");
  const userId = useAttribute("user-id");

  // Add state for fetched agent config (moved here to be available for overrides)
  const fetchedAgentConfig = useSignal<AgentConfig | null>(null);

  const overrides = useComputed<SessionConfig["overrides"]>(() => {
    const baseOverrides: SessionConfig["overrides"] = {
      agent: {
        prompt: {
          prompt: overridePrompt.value,
        },
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
        textOnly: parseBoolAttribute(overrideTextOnly.value) ?? undefined,
      },
    };

    // If we have fetched agent config, merge it with overrides
    if (fetchedAgentConfig.value) {
      const config = fetchedAgentConfig.value;

      // Apply fetched config as base, with attribute overrides taking precedence
      return {
        agent: {
          prompt: {
            prompt: config.agent?.prompt?.prompt || overridePrompt.value,
            llm: overrideLLM.value,
          },
          firstMessage: config.agent?.firstMessage || overrideFirstMessage.value,
          language: config.agent?.language || language.value.languageCode,
        },
        tts: {
          voiceId: config.tts?.voiceId || overrideVoiceId.value,
          speed: overrideSpeed.value ? parseFloat(overrideSpeed.value) : undefined,
          stability: overrideStability.value ? parseFloat(overrideStability.value) : undefined,
          similarityBoost: overrideSimilarityBoost.value
            ? parseFloat(overrideSimilarityBoost.value)
            : undefined,
        },
        conversation: {
          textOnly:
            !!config.conversation?.textOnly ||
            (parseBoolAttribute(overrideTextOnly.value) ?? undefined),
        },
      };
    }

    return baseOverrides;
  });

  const dynamicVariablesJSON = useAttribute("dynamic-variables");
  const dynamicVariables = useComputed(() => {
    if (dynamicVariablesJSON.value) {
      try {
        return JSON.parse(dynamicVariablesJSON.value) as DynamicVariables;
      } catch (e: any) {
        console.error(`[ConversationalAI] Cannot parse dynamic-variables: ${e?.message}`);
      }
    }

    return undefined;
  });

  const rawAudioProcessor = useAttribute("worklet-path-raw-audio-processor");
  const audioConcatProcessor = useAttribute("worklet-path-audio-concat-processor");
  const libsamplerate = useAttribute("worklet-path-libsamplerate");

  const { webSocketUrl } = useServerLocation();
  const agentId = useAttribute("agent-id");
  const widgetId = useAttribute("widget-id");
  const apiBaseUrl = useAttribute("api-base-url");
  const portalHostname = useAttribute("portal-hostname");
  const signedUrl = useAttribute("signed-url");
  const environment = useAttribute("environment");
  const textOnly = useTextOnly();
  const useWebRTCEnabled = useWebRTC();

  // Add state for fetched signed URL
  const fetchedSignedUrl = useSignal<string | null>(null);
  const loadedLegacyKey = useSignal("");

  // Resolve the legacy bootstrap before exposing interactive controls. Rendering
  // them first and then entering a loading state discarded clicks and language
  // selection when a fast bootstrap response remounted the conversation subtree.
  useEffect(() => {
    const id = agentId.value;
    if (widgetId.value || !id) return;
    const explicitUrl = signedUrl.value;
    const key = `${id}|${explicitUrl ?? ""}`;
    let cancelled = false;
    Promise.all([
      explicitUrl ? Promise.resolve(null) : fetchSignedUrl(id),
      fetchAgentConfig(id),
    ]).then(([url, agent]) => {
      if (cancelled) return;
      fetchedSignedUrl.value = url;
      fetchedAgentConfig.value = agent;
      loadedLegacyKey.value = key;
    });
    return () => {
      cancelled = true;
    };
  }, [widgetId.value, agentId.value, signedUrl.value]);

  const value = useComputed<SessionConfig | null>(() => {
    const isWebRTC = useWebRTCEnabled.value;
    const baseConfig = {
      dynamicVariables: dynamicVariables.value,
      overrides: overrides.value,
      connectionDelay: { default: 300 },
      textOnly: textOnly.value,
      userId: userId.value || undefined,
      environment: environment.value || undefined,
      libsampleratePath: libsamplerate.value,
      workletPaths: {
        rawAudioProcessor: rawAudioProcessor.value,
        audioConcatProcessor: audioConcatProcessor.value,
      },
    } as const satisfies Partial<SessionConfig | AudioWorkletConfig>;

    // Hosted widgets obtain fresh access at each start through the resolver.
    // This empty connection is never passed to the SDK.
    if (widgetId.value) {
      return { ...baseConfig, signedUrl: "", connectionType: "websocket" as const };
    }

    // If explicit signed URL is provided, use it
    if (signedUrl.value) {
      return {
        signedUrl: signedUrl.value,
        connectionType: "websocket" as const,
        ...baseConfig,
      };
    }

    if (agentId.value && loadedLegacyKey.value !== `${agentId.value}|${signedUrl.value ?? ""}`)
      return null;

    // If fetched signed URL is available, use it
    if (fetchedSignedUrl.value) {
      return {
        signedUrl: fetchedSignedUrl.value,
        connectionType: "websocket" as const,
        ...baseConfig,
      };
    }

    // Fallback to agentId-based config
    if (agentId.value) {
      if (isWebRTC) {
        return {
          agentId: agentId.value,
          origin: webSocketUrl.value,
          connectionType: "webrtc" as const,
          ...baseConfig,
        };
      } else {
        return {
          agentId: agentId.value,
          origin: webSocketUrl.value,
          connectionType: "websocket" as const,
          ...baseConfig,
        };
      }
    }

    console.error("[ConversationalAI] Either agent-id or signed-url is required");
    return null;
  });

  if (!value.value) {
    return null;
  }

  const resolveSession = async (config: SessionConfig): Promise<SessionConfig> => {
    if (!widgetId.value) return config;
    const url = websiteWidgetUrl(apiBaseUrl.value, widgetId.value, portalHostname.value, "session");
    const response = await fetch(url, { method: "POST", credentials: "omit" });
    if (!response.ok) throw new Error("This website assistant is currently unavailable.");
    const data = await response.json();
    if (typeof data.signedUrl !== "string" || !data.signedUrl.startsWith("wss://")) {
      throw new Error("Could not start the website assistant.");
    }
    if (typeof data.dynamicVariables?.website_session_id !== "string") {
      throw new Error("Could not start the website assistant.");
    }
    return {
      ...config,
      agentId: undefined,
      conversationToken: undefined,
      signedUrl: data.signedUrl,
      connectionType: "websocket",
      textOnly: data.textOnly === true || config.textOnly === true,
      overrides: {
        agent: {
          firstMessage:
            typeof data.overrides?.agent?.firstMessage === "string"
              ? data.overrides.agent.firstMessage
              : undefined,
          language: data.overrides?.agent?.language === "fr" ? "fr" : "en",
        },
        conversation: { textOnly: data.textOnly === true || config.textOnly === true },
      },
      dynamicVariables: {
        ...config.dynamicVariables,
        website_session_id: data.dynamicVariables.website_session_id,
      },
    };
  };

  return (
    <SessionConfigContext.Provider value={value as ReadonlySignal<SessionConfig>}>
      <SessionResolverContext.Provider value={resolveSession}>
        {children}
      </SessionResolverContext.Provider>
    </SessionConfigContext.Provider>
  );
}

export function useSessionConfig() {
  return useContextSafely(SessionConfigContext);
}

export function useSessionConfigResolver() {
  return useContextSafely(SessionResolverContext);
}
