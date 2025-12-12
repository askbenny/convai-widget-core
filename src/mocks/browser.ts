import { http, HttpResponse, ws } from "msw";
import { setupWorker } from "msw/browser";
import { WidgetConfig } from "../types/config";

const BASIC_CONFIG: WidgetConfig = {
  variant: "full",
  placement: "bottom-right",
  avatar: {
    type: "orb",
    color_1: "#000000",
    color_2: "#ffffff",
  },
  feedback_mode: "end",
  language: "en",
  mic_muting_enabled: false,
  transcript_enabled: false,
  text_input_enabled: false,
  text_contents: {
    start_chat: "Start a call",
  },
  terms_html: "Test terms",
  language_presets: {},
  disable_banner: false,
  text_only: false,
  supports_text_only: true,
  first_message: "Agent response",
  default_expanded: false,
  always_expanded: false,
};

export const AGENTS = {
  basic: BASIC_CONFIG,
  text_only: {
    ...BASIC_CONFIG,
    text_only: true,
  },
  fail: BASIC_CONFIG,
} as const satisfies Record<string, WidgetConfig>;

function isValidAgentId(agentId: string): agentId is keyof typeof AGENTS {
  return agentId in AGENTS;
}

const serverUrl =
  (import.meta as { env?: { VITE_SERVER_URL_US?: string } }).env?.VITE_SERVER_URL_US ||
  "https://api.elevenlabs.io";
const wsUrl =
  (import.meta as { env?: { VITE_WEBSOCKET_URL_US?: string } }).env?.VITE_WEBSOCKET_URL_US ||
  "wss://api.elevenlabs.io";

export const Worker = setupWorker(
  http.get<{ agentId: string }>(`${serverUrl}/v1/convai/agents/:agentId/widget`, ({ params }) => {
    if (isValidAgentId(params.agentId)) {
      return HttpResponse.json({
        agent_id: params.agentId,
        widget_config: AGENTS[params.agentId],
      });
    }

    return HttpResponse.error();
  }),
  ws.link(`${wsUrl}/v1/convai/conversation`).addEventListener("connection", async ({ client }) => {
    const agentId = client.url.searchParams.get("agent_id") as keyof typeof AGENTS;
    const config = AGENTS[agentId];
    const conversationId = Math.random().toString(36).substring(7);
    client.send(
      JSON.stringify({
        type: "conversation_initiation_metadata",
        conversation_initiation_metadata_event: {
          conversation_id: conversationId,
          agent_output_audio_format: "pcm_16000",
          user_input_audio_format: "pcm_16000",
        },
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    client.send(
      JSON.stringify({
        type: "agent_response",
        agent_response_event: { agent_response: config.first_message },
      })
    );
    if (config.text_only) {
      client.send(
        JSON.stringify({
          type: "agent_response",
          agent_response_event: {
            agent_response: "Another agent response",
          },
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      client.close();
    } else {
      client.send(
        JSON.stringify({
          type: "user_transcript",
          user_transcription_event: { user_transcript: "User transcript" },
        })
      );
    }
    if (agentId === "fail") {
      client.addEventListener("message", () => {
        client.close(3000, "Test reason");
      });
    }
  })
);
