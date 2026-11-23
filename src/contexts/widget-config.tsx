import { ReadonlySignal, batch, useComputed, useSignal, useSignalEffect } from "@preact/signals";
import { TinyColor } from "@ctrl/tinycolor";
import { ComponentChildren } from "preact";
import { createContext } from "preact/compat";
import {
  DefaultStyles,
  parseDefaultSize,
  parseLayout,
  parsePlacement,
  parseVariant,
  type SyntaxHighlightTheme,
  type WidgetConfig,
} from "../types/config";
import { useAttribute } from "./attributes";
import { useOrchestrator } from "./orchestrator-config";
import { useServerLocation } from "./server-location";

import { useContextSafely } from "../utils/useContextSafely";
import { loadWidgetPresentation } from "../utils/widget-presentation";
import { primeWidgetConfig } from "../utils/managed-session";
import { parseBoolAttribute } from "../types/attributes";
import { useLanguageConfig } from "./language-config";
import { useConversation } from "./conversation";
import { useSessionConfig, useSessionPresentation } from "./session-config";
import { interpolateDynamicVariables, parseDynamicVariables } from "../utils/dynamicVariables";

const WidgetConfigContext = createContext<ReadonlySignal<WidgetConfig> | null>(null);
const AgentTextOnlyContext = createContext<ReadonlySignal<boolean> | null>(null);

// Self-hosted orchestrators have no HTTP API to serve a widget appearance config.
const DefaultOrchestratorWidgetConfig: WidgetConfig = {
  variant: "full",
  placement: "bottom-right",
  avatar: {
    type: "orb",
    color_1: "#2792dc",
    color_2: "#9ce6e6",
  },
  feedback_mode: "none",
  language: "en",
  mic_muting_enabled: false,
  transcript_enabled: true,
  text_input_enabled: true,
  default_expanded: false,
  always_expanded: false,
  dismissible: false,
  text_contents: {},
  language_presets: {},
  disable_banner: false,
  text_only: false,
  supports_text_only: true,
};

// How long the first paint waits to learn whether the agent is chat only. A slower
// answer still applies when it arrives; a failed one leaves the provider's setting.
export const MANAGED_TEXT_ONLY_WAIT_MS = 2000;

function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    void promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

interface WidgetConfigProviderProps {
  children: ComponentChildren;
}

export function WidgetConfigProvider({ children }: WidgetConfigProviderProps) {
  const { serverUrl } = useServerLocation();
  const agentId = useAttribute("agent-id");
  const overrideConfig = useAttribute("override-config");
  const signedUrl = useAttribute("signed-url");
  const environment = useAttribute("environment");
  const orchestrator = useOrchestrator();
  const fetchedConfig = useSignal<WidgetConfig | null>(null);
  // "Chat only" is an Ask Benny setting. The provider's presentation never carries it.
  const managedTextOnly = useSignal(false);

  useSignalEffect(() => {
    if (overrideConfig.value) {
      try {
        const config = JSON.parse(overrideConfig.value);
        if (config) {
          // The host owns this presentation, its text_only included.
          batch(() => {
            fetchedConfig.value = config;
            managedTextOnly.value = false;
          });
          return;
        }
      } catch (error: any) {
        console.error(`[ConversationalAI] Cannot parse override-config: ${error?.message}`);
      }
    }
    if (orchestrator.enabled.value) {
      batch(() => {
        fetchedConfig.value = structuredClone(DefaultOrchestratorWidgetConfig);
        managedTextOnly.value = false;
      });
      return;
    }
    let currentAgentId: string | undefined = agentId.value;
    let conversationSignature: string | undefined;
    if (signedUrl.value) {
      const params = new URL(signedUrl.value).searchParams;
      currentAgentId = params.get("agent_id") ?? agentId.value;
      conversationSignature = params.get("conversation_signature") ?? undefined;
    }

    if (!currentAgentId) {
      fetchedConfig.value = null;
      return;
    }

    const abort = new AbortController();
    // A host passing its own signed URL owns the session, so there is nothing to ask.
    const textOnly = signedUrl.value
      ? Promise.resolve(false)
      : primeWidgetConfig(currentAgentId, environment.value).then(
          (agent) => agent.conversation?.textOnly === true,
          () => false
        );
    // Both are known before the first paint, so a chat-only launcher never shows a call button.
    Promise.all([
      loadWidgetPresentation({
        agentId: currentAgentId,
        serverUrl: serverUrl.value,
        signal: abort.signal,
        conversationSignature,
        environment: environment.value,
      }),
      settleWithin(textOnly, MANAGED_TEXT_ONLY_WAIT_MS),
    ])
      .then(([config, knownTextOnly]) => {
        if (abort.signal.aborted) return;
        batch(() => {
          fetchedConfig.value = config;
          managedTextOnly.value = knownTextOnly ?? false;
        });
        if (knownTextOnly === undefined) {
          void textOnly.then((late) => {
            if (!abort.signal.aborted) managedTextOnly.value = late;
          });
        }
      })
      .catch((error) => {
        console.error(
          `[ConversationalAI] Cannot fetch config for agent ${agentId.value}: ${error?.message}`
        );
        if (!abort.signal.aborted) {
          fetchedConfig.value = null;
        }
      });

    return () => {
      abort.abort();
    };
  });

  const variant = useAttribute("variant");
  const placement = useAttribute("placement");
  const termsKey = useAttribute("terms-key");
  const micMuting = useAttribute("mic-muting");
  const transcript = useAttribute("transcript");
  const textInput = useAttribute("text-input");
  const defaultExpanded = useAttribute("default-expanded");
  const alwaysExpanded = useAttribute("always-expanded");
  const dismissible = useAttribute("dismissible");
  const stripAudioTags = useAttribute("strip-audio-tags");
  const overrideTextOnly = useAttribute("override-text-only");
  const useRtc = useAttribute("use-rtc");
  const showAgentStatus = useAttribute("show-agent-status");
  const showConversationId = useAttribute("show-conversation-id");
  const disableBanner = useAttribute("disable-banner");
  const showResizeButton = useAttribute("show-resize-button");
  const mobileFullscreen = useAttribute("mobile-fullscreen");
  const defaultSize = useAttribute("default-size");
  const expandOnCarousel = useAttribute("expand-on-carousel");
  const layout = useAttribute("layout");
  const transcriptSpeechSync = useAttribute("transcript-speech-sync");
  const endConfirmation = useAttribute("end-confirmation");
  const showLanguageSelectorOnTrigger = useAttribute("show-language-selector-on-trigger");

  const agentTextOnly = useComputed(
    () => parseBoolAttribute(overrideTextOnly.value) ?? fetchedConfig.value?.text_only ?? false
  );

  const value = useComputed<WidgetConfig | null>(() => {
    if (!fetchedConfig.value) {
      return null;
    }

    const patchedVariant = variant.value ?? fetchedConfig.value.variant;
    const patchedPlacement = placement.value ?? fetchedConfig.value.placement;
    const patchedTermsKey = termsKey.value ?? fetchedConfig.value.terms_key;

    // The session Ask Benny signs for a chat-only agent is text only whatever the page asks for.
    const textOnly = managedTextOnly.value || agentTextOnly.value;

    const patchedMicMuting =
      parseBoolAttribute(micMuting.value) ?? fetchedConfig.value.mic_muting_enabled;
    const patchedTranscript =
      parseBoolAttribute(transcript.value) ?? fetchedConfig.value.transcript_enabled;
    const patchedTextInput =
      parseBoolAttribute(textInput.value) ?? fetchedConfig.value.text_input_enabled;
    const patchedLayout = parseLayout(layout.value ?? fetchedConfig.value.layout);
    const isPage = patchedLayout === "page";
    const patchedAlwaysExpanded =
      parseBoolAttribute(alwaysExpanded.value) ?? fetchedConfig.value.always_expanded ?? false;
    const patchedDefaultExpanded =
      parseBoolAttribute(defaultExpanded.value) ?? fetchedConfig.value.default_expanded ?? false;
    const patchedDismissible =
      parseBoolAttribute(dismissible.value) ?? fetchedConfig.value.dismissible ?? false;
    const patchedStripAudioTags =
      parseBoolAttribute(stripAudioTags.value) ??
      fetchedConfig.value.strip_audio_tags ??
      !agentTextOnly.value;
    const patchedUseRtc = parseBoolAttribute(useRtc.value) ?? fetchedConfig.value.use_rtc ?? false;
    const patchedShowAgentStatus =
      parseBoolAttribute(showAgentStatus.value) ?? fetchedConfig.value.show_agent_status ?? false;
    const patchedShowConversationId =
      parseBoolAttribute(showConversationId.value) ??
      fetchedConfig.value.show_conversation_id ??
      true;
    const patchedDisableBanner =
      parseBoolAttribute(disableBanner.value) ?? fetchedConfig.value.disable_banner ?? false;
    const patchedShowResizeButton =
      parseBoolAttribute(showResizeButton.value) ?? fetchedConfig.value.show_resize_button ?? true;
    const patchedMobileFullscreen =
      parseBoolAttribute(mobileFullscreen.value) ?? fetchedConfig.value.mobile_fullscreen ?? true;
    const patchedExpandOnCarousel =
      parseBoolAttribute(expandOnCarousel.value) ?? fetchedConfig.value.expand_on_carousel ?? false;
    const patchedTranscriptSpeechSync =
      parseBoolAttribute(transcriptSpeechSync.value) ??
      fetchedConfig.value.transcript_speech_sync_enabled ??
      true;
    const patchedEndConfirmation =
      parseBoolAttribute(endConfirmation.value) ??
      fetchedConfig.value.end_confirmation_enabled ??
      false;
    const patchedShowLanguageSelectorOnTrigger =
      parseBoolAttribute(showLanguageSelectorOnTrigger.value) ??
      fetchedConfig.value.show_language_selector_on_trigger ??
      true;

    return {
      ...fetchedConfig.value,
      variant: parseVariant(patchedVariant),
      placement: parsePlacement(patchedPlacement),
      terms_key: patchedTermsKey,
      text_only: textOnly,
      mic_muting_enabled: !textOnly && patchedMicMuting,
      // A page always shows the chat
      transcript_enabled: textOnly || isPage || patchedTranscript,
      text_input_enabled: textOnly || isPage || patchedTextInput,
      // A page has nothing to collapse into or dismiss to
      always_expanded: isPage || patchedAlwaysExpanded,
      default_expanded: patchedDefaultExpanded,
      dismissible: !isPage && patchedDismissible,
      strip_audio_tags: patchedStripAudioTags,
      use_rtc: patchedUseRtc,
      show_agent_status: patchedShowAgentStatus,
      show_conversation_id: patchedShowConversationId,
      disable_banner: patchedDisableBanner,
      show_resize_button: !isPage && patchedShowResizeButton,
      mobile_fullscreen: patchedMobileFullscreen,
      default_size: parseDefaultSize(defaultSize.value ?? fetchedConfig.value.default_size),
      expand_on_carousel: patchedExpandOnCarousel,
      layout: patchedLayout,
      transcript_speech_sync_enabled: patchedTranscriptSpeechSync,
      end_confirmation_enabled: patchedEndConfirmation,
      show_language_selector_on_trigger: patchedShowLanguageSelectorOnTrigger,
    };
  });

  if (!value.value) {
    return null;
  }

  return (
    <WidgetConfigContext.Provider value={value as ReadonlySignal<WidgetConfig>}>
      <AgentTextOnlyContext.Provider value={agentTextOnly}>
        {children}
      </AgentTextOnlyContext.Provider>
    </WidgetConfigContext.Provider>
  );
}

export function useWidgetConfig() {
  return useContextSafely(WidgetConfigContext);
}

export function useTextOnly() {
  const config = useWidgetConfig();

  // Already resolved by the provider: Ask Benny's setting, the attribute, then the agent's own.
  return useComputed(() => config.value.text_only ?? false);
}

/**
 * Whether the agent itself is text only, before Ask Benny's "Chat only" setting. A chat-only
 * widget on a voice agent still gets text written for speech, audio tags included.
 */
export function useAgentTextOnly() {
  return useContextSafely(AgentTextOnlyContext);
}

export function useIsConversationTextOnly() {
  const textOnly = useTextOnly();
  const { conversationTextOnly } = useConversation();
  const sessionConfig = useSessionConfig();

  return useComputed(
    () =>
      conversationTextOnly.value ??
      sessionConfig.value.overrides?.conversation?.textOnly ??
      textOnly.value
  );
}

export function useFirstMessage() {
  const presentation = useSessionPresentation();
  const override = useAttribute("override-first-message");
  const config = useWidgetConfig();
  const { language } = useLanguageConfig();
  const dynamicVariablesJSON = useAttribute("dynamic-variables");
  return useComputed(() => {
    const firstMessage =
      override.value ??
      config.value.language_presets?.[language.value.languageCode]?.first_message ??
      presentation.value?.agent?.firstMessage ??
      config.value.first_message ??
      null;
    if (firstMessage == null) {
      return null;
    }
    return interpolateDynamicVariables(
      firstMessage,
      parseDynamicVariables(dynamicVariablesJSON.value)
    );
  });
}

export function useFirstMessageRichContent() {
  const config = useWidgetConfig();
  const { language } = useLanguageConfig();
  return useComputed(
    () =>
      config.value.language_presets?.[language.value.languageCode]?.first_message_rich_content ??
      config.value.first_message_rich_content ??
      null
  );
}

export function useTextInputEnabled() {
  const config = useWidgetConfig();
  return useComputed(() => config.value.text_input_enabled ?? false);
}

export function useTriggerEntryPoints() {
  const textOnly = useTextOnly();
  return {
    showCall: useComputed(() => !textOnly.value),
    showMessage: useTextInputEnabled(),
  };
}

export function useFileInputEnabled() {
  const config = useWidgetConfig();
  const orchestrator = useOrchestrator();
  // File uploads post to the ElevenLabs cloud API, which orchestrator sessions must never call.
  return useComputed(
    () => !orchestrator.enabled.value && (config.value.file_input_config?.enabled ?? false)
  );
}

export function useFileInputMaxFiles() {
  const config = useWidgetConfig();
  return useComputed(() => config.value.file_input_config?.max_files_per_conversation ?? null);
}

export function useLocalizedTerms() {
  const config = useWidgetConfig();
  const { language } = useLanguageConfig();

  return useComputed(() => {
    if (config.value.terms_html == null && config.value.terms_text == null) {
      return {
        terms_html: undefined,
        terms_text: undefined,
        terms_key: undefined,
      };
    }

    const languagePreset = config.value.language_presets?.[language.value.languageCode];

    return {
      terms_html: languagePreset?.terms_html ?? config.value.terms_html,
      terms_text: languagePreset?.terms_text ?? config.value.terms_text,
      terms_key: languagePreset?.terms_key ?? config.value.terms_key,
    };
  });
}

export function useWebRTC() {
  const config = useWidgetConfig();
  return useComputed(() => config.value.use_rtc ?? false);
}

export function useEndFeedbackType() {
  const config = useWidgetConfig();
  const orchestrator = useOrchestrator();
  // End-of-call feedback posts to the ElevenLabs cloud API, which orchestrator sessions must never call.
  return useComputed(() =>
    orchestrator.enabled.value ? null : (config.value.end_feedback?.type ?? null)
  );
}

export interface MarkdownLinkConfig {
  allowedHosts: string[];
  includeWww: boolean;
  allowHttp: boolean;
}

export function useMarkdownLinkConfig() {
  const overrideHosts = useAttribute("markdown-link-allowed-hosts");
  const overrideIncludeWww = useAttribute("markdown-link-include-www");
  const overrideAllowHttp = useAttribute("markdown-link-allow-http");
  const config = useWidgetConfig();

  return useComputed<MarkdownLinkConfig>(() => {
    let allowedHosts: string[] = [];

    if (overrideHosts.value) {
      allowedHosts = overrideHosts.value
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
    } else {
      const hosts = config.value.markdown_link_allowed_hosts;
      if (hosts && hosts.length > 0) {
        const hasWildcard = hosts.some((h) => h.hostname === "*");
        if (hasWildcard) {
          allowedHosts = ["*"];
        } else {
          allowedHosts = hosts.map((h) => h.hostname);
        }
      }
    }

    const includeWww =
      parseBoolAttribute(overrideIncludeWww.value) ??
      config.value.markdown_link_include_www ??
      true;

    const allowHttp =
      parseBoolAttribute(overrideAllowHttp.value) ?? config.value.markdown_link_allow_http ?? true;

    return { allowedHosts, includeWww, allowHttp };
  });
}

export function useSyntaxTheme() {
  const override = useAttribute("syntax-highlight-theme");
  const config = useWidgetConfig();

  return useComputed<SyntaxHighlightTheme>(() => {
    // Explicit override takes priority
    const explicitValue = override.value ?? config.value.syntax_highlight_theme;
    if (explicitValue === "light" || explicitValue === "dark") {
      return explicitValue;
    }
    // Auto-detect based on base_active background color
    const baseActive = config.value.styles?.base_active ?? DefaultStyles.base_active;
    const color = new TinyColor(baseActive);

    if (!color.isValid) {
      return "light";
    }
    return color.isDark() ? "dark" : "light";
  });
}

export function useAllowEvents() {
  const allowEvents = useAttribute("allow-events");
  return useComputed(() => {
    return parseBoolAttribute(allowEvents.value) ?? false;
  });
}
