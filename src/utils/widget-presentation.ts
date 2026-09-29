import type { WidgetConfig } from "../types/config";
import { fetchWidgetSession } from "./managed-session";

/** The provider refused an unsigned presentation request: the agent has authentication on. */
export class WidgetPresentationAuthRequiredError extends Error {
  constructor() {
    super("This agent requires a signed presentation request.");
    this.name = "WidgetPresentationAuthRequiredError";
  }
}

export async function fetchWidgetPresentation(
  agentId: string,
  serverUrl: string,
  signal: AbortSignal,
  conversationSignature?: string
): Promise<WidgetConfig> {
  const response = await fetch(
    `${serverUrl}/v1/convai/agents/${agentId}/widget${conversationSignature ? `?conversation_signature=${encodeURIComponent(conversationSignature)}` : ""}`,
    { signal }
  );
  if (response.status === 401 || response.status === 403) {
    throw new WidgetPresentationAuthRequiredError();
  }
  const data = await response.json();
  if (!data.widget_config) {
    throw new Error("Response does not contain widget_config");
  }
  return data.widget_config;
}

export interface LoadWidgetPresentationOptions {
  agentId: string;
  serverUrl: string;
  signal: AbortSignal;
  /** From an explicit `signed-url` attribute; the host owns session acquisition. */
  conversationSignature?: string;
  /** The `environment` attribute, selecting the Ask Benny API that signs managed sessions. */
  environment?: string;
}

/**
 * Loads the widget's presentation (colors, texts, layout) from the provider.
 *
 * Agents with authentication on reject unsigned presentation requests, which used to leave the
 * widget hidden. For managed embeds (`agent-id` only) the request is retried once with the
 * conversation signature of a fresh Ask Benny widget session. Agents without authentication keep
 * the single unsigned request, and hosts passing their own `signed-url` keep their signature.
 */
export async function loadWidgetPresentation({
  agentId,
  serverUrl,
  signal,
  conversationSignature,
  environment,
}: LoadWidgetPresentationOptions): Promise<WidgetConfig> {
  try {
    return await fetchWidgetPresentation(agentId, serverUrl, signal, conversationSignature);
  } catch (error) {
    if (!(error instanceof WidgetPresentationAuthRequiredError) || conversationSignature) {
      throw error;
    }
    const session = await fetchWidgetSession(agentId, environment, signal);
    const signature = new URL(session.signedUrl).searchParams.get("conversation_signature");
    if (!signature) {
      throw error;
    }
    return fetchWidgetPresentation(agentId, serverUrl, signal, signature);
  }
}
