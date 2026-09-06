import type { SessionConfig } from "@elevenlabs/client";

export interface PublicAgentConfig {
  schemaVersion: 2;
  agentId: string;
  branchId?: string;
  demo?: boolean;
  agent?: { firstMessage?: string; language?: string };
  tts?: { voiceId?: string };
  conversation?: { textOnly?: boolean };
}
export interface ManagedSession extends PublicAgentConfig {
  signedUrl: string;
  dynamicVariables?: Record<string, string>;
}
const DEMO_AGENT = "8ejsnHgt61Q30A38AIKr";
const unavailable = () =>
  new Error("The website assistant is preparing. Please try again shortly.");

export function widgetApiOrigin(environment?: string): string {
  if (!environment || environment === "production") return "https://api.askbenny.ca";
  if (environment === "development") return "https://api-dev.askbenny.ca";
  throw new Error("Unsupported website assistant environment.");
}

export async function fetchWidgetConfig(
  agentId: string,
  environment: string | undefined,
  signal: AbortSignal
): Promise<PublicAgentConfig> {
  return requestWidget("agents/config", agentId, environment, signal);
}
async function requestWidget(
  path: string,
  agentId: string,
  environment: string | undefined,
  signal: AbortSignal
) {
  const response = await fetch(
    `${widgetApiOrigin(environment)}/elevenlabs/${path}?agentId=${encodeURIComponent(agentId)}`,
    { signal, cache: "no-store" }
  );
  if (!response.ok) throw unavailable();
  const { body } = await response.json();
  // Reject old servers, mismatched agents and absent branches. Never consume prompts.
  if (
    body?.schemaVersion !== 2 ||
    body.agentId !== agentId ||
    !(
      (typeof body.branchId === "string" && body.branchId.length > 0) ||
      (agentId === DEMO_AGENT && body.demo === true)
    )
  )
    throw unavailable();
  return body;
}
export async function fetchWidgetSession(
  agentId: string,
  environment: string | undefined,
  signal: AbortSignal
): Promise<ManagedSession> {
  const body = await requestWidget("signed-url", agentId, environment, signal);
  let url: URL;
  try {
    url = new URL(body.signedUrl);
  } catch {
    throw unavailable();
  }
  if (url.protocol !== "wss:" || !url.hostname.endsWith(".elevenlabs.io")) throw unavailable();
  return body;
}

/** Applied AFTER the public call event: callbacks cannot accidentally reinstate a main-agent session or private prompt. */
export function applyManagedSession(config: SessionConfig, session: ManagedSession): SessionConfig {
  const {
    agentId: _agentId,
    conversationToken: _token,
    origin: _origin,
    signedUrl: _url,
    ...base
  } = config as SessionConfig & {
    agentId?: string;
    conversationToken?: string;
    origin?: string;
    signedUrl?: string;
  };
  const requested = config.overrides;
  return {
    ...base,
    signedUrl: session.signedUrl,
    connectionType: "websocket",
    dynamicVariables: { ...config.dynamicVariables, ...session.dynamicVariables },
    textOnly: session.conversation?.textOnly || config.textOnly,
    overrides: {
      agent: { firstMessage: requested?.agent?.firstMessage, language: requested?.agent?.language },
      tts: {
        voiceId: requested?.tts?.voiceId,
        speed: requested?.tts?.speed,
        stability: requested?.tts?.stability,
        similarityBoost: requested?.tts?.similarityBoost,
      },
      conversation: {
        textOnly: session.conversation?.textOnly || requested?.conversation?.textOnly,
      },
    },
  };
}
