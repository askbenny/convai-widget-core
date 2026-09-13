import { render } from "preact";
import { act } from "preact/test-utils";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { Conversation } from "@elevenlabs/client";
import { Worker } from "../mocks/browser";
import type { CustomAttributes } from "../types/attributes";
import { AttributesProvider } from "./attributes";
import { ServerLocationProvider } from "./server-location";
import { WidgetConfigProvider, useFirstMessage } from "./widget-config";
import { LanguageConfigProvider } from "./language-config";
import { TermsProvider, useTerms } from "./terms";
import { SessionConfigProvider, useSessionPresentation } from "./session-config";
import { ConversationProvider, useConversation } from "./conversation";
import { ShadowHostProvider } from "./shadow-host";

let state: {
  conversation: ReturnType<typeof useConversation>;
  terms: ReturnType<typeof useTerms>;
  greeting: ReturnType<typeof useFirstMessage>;
  presentation: ReturnType<typeof useSessionPresentation>;
};
const container = document.createElement("div");
function Probe() {
  state = {
    conversation: useConversation(),
    terms: useTerms(),
    greeting: useFirstMessage(),
    presentation: useSessionPresentation(),
  };
  return null;
}
function mount(attributes: CustomAttributes = {}) {
  act(() =>
    render(
      <ShadowHostProvider>
        <AttributesProvider value={{ "agent-id": "basic", ...attributes }}>
          <ServerLocationProvider>
            <WidgetConfigProvider>
              <LanguageConfigProvider>
                <TermsProvider>
                  <SessionConfigProvider>
                    <ConversationProvider>
                      <Probe />
                    </ConversationProvider>
                  </SessionConfigProvider>
                </TermsProvider>
              </LanguageConfigProvider>
            </WidgetConfigProvider>
          </ServerLocationProvider>
        </AttributesProvider>
      </ShadowHostProvider>,
      container
    )
  );
}
const signedBody = {
  schemaVersion: 2,
  agentId: "basic",
  branchId: "widget-basic",
  signedUrl: "wss://api.elevenlabs.io/v1/convai/conversation?token=fresh",
  agent: { firstMessage: "Fresh greeting" },
  conversation: { textOnly: true },
};
beforeAll(async () => {
  document.body.appendChild(container);
  await Worker.start({ quiet: true, onUnhandledRequest: "error" });
});
afterEach(() => {
  act(() => render(null, container));
  Worker.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  Worker.stop();
  container.remove();
});

describe("managed session lifecycle", () => {
  it.each([
    { "agent-id": "text_only" },
    { environment: "development" },
    { "signed-url": signedBody.signedUrl },
  ])("silently cancels preparation when identity changes to %j", async (attributes) => {
    let requested = false;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    Worker.use(
      http.get("https://api.askbenny.ca/elevenlabs/signed-url", async () => {
        requested = true;
        await pending;
        return HttpResponse.json({ body: signedBody });
      })
    );
    const sdk = vi.spyOn(Conversation, "startSession");
    mount();
    await vi.waitFor(() => expect(state.presentation.peek()).not.toBeNull());
    const starting = state.conversation.startSession(container);
    state.terms.acceptTerms();
    await vi.waitFor(() =>
      expect({
        requested,
        error: state.conversation.error.peek(),
        status: state.conversation.status.peek(),
        terms: state.terms.termsShown.peek(),
      }).toEqual({ requested: true, error: null, status: "connecting", terms: false })
    );
    mount(attributes);
    release();
    await starting;
    expect(sdk).not.toHaveBeenCalled();
    expect(state.conversation.error.peek()).toBeNull();
    expect(state.conversation.transcript.peek().some((entry) => entry.type === "error")).toBe(
      false
    );
    expect(state.conversation.status.peek()).toBe("disconnected");
  });

  it.each(["failed", "late"])(
    "recovers greeting from signing after a %s presentation request",
    async (mode) => {
      let requested = false;
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      Worker.use(
        http.get("https://api.askbenny.ca/elevenlabs/agents/config", async () => {
          requested = true;
          if (mode === "failed") return new HttpResponse(null, { status: 503 });
          await pending;
          return HttpResponse.json({
            body: { ...signedBody, agent: { firstMessage: "Stale greeting" } },
          });
        }),
        http.get("https://api.askbenny.ca/elevenlabs/signed-url", () =>
          HttpResponse.json({ body: signedBody })
        )
      );
      const sdk = vi.spyOn(Conversation, "startSession").mockImplementation(async (config) => {
        expect(state.greeting.peek()).toBe("Fresh greeting");
        config.onMessage?.({ source: "ai", role: "agent", message: "Fresh greeting", event_id: 1 });
        config.onMessage?.({ source: "ai", role: "agent", message: "Actual answer", event_id: 2 });
        return {
          getId: () => "conversation",
          isOpen: () => true,
          endSession: async () => {},
          sendUserMessage: () => {},
        } as unknown as Conversation;
      });
      mount();
      await vi.waitFor(() => expect(requested).toBe(true));
      state.terms.acceptTerms();
      await state.conversation.startSession(container, "Hello");
      release();
      await vi.waitFor(() => expect(state.greeting.peek()).toBe("Fresh greeting"));
      expect(sdk).toHaveBeenCalledOnce();
      expect(state.presentation.peek()).not.toHaveProperty("signedUrl");
      const transcript = state.conversation.transcript.peek();
      expect(
        transcript.some((entry) => entry.type === "message" && entry.message === "Fresh greeting")
      ).toBe(false);
      expect(
        transcript.some((entry) => entry.type === "message" && entry.message === "Actual answer")
      ).toBe(true);
    }
  );
});

type SDKConfig = Parameters<typeof Conversation.startSession>[0];
async function captureSession(attributes: CustomAttributes = {}, initialMessage?: string) {
  let callbacks!: SDKConfig;
  vi.spyOn(Conversation, "startSession").mockImplementation(async (config) => {
    callbacks = config;
    let open = true;
    config.onStatusChange?.({ status: "connected" });
    return {
      getId: () => "conversation",
      isOpen: () => open,
      endSession: async () => {
        open = false;
        config.onDisconnect?.({ reason: "user" });
        config.onStatusChange?.({ status: "disconnected" });
      },
      sendUserMessage: () => {},
    } as unknown as Conversation;
  });
  const previous = state;
  mount(attributes);
  await vi.waitFor(() => {
    expect(state).not.toBe(previous);
    expect(state.presentation.peek()).not.toBeNull();
  });
  state.terms.acceptTerms();
  await state.conversation.startSession(container, initialMessage);
  return callbacks;
}
function agentMessage(config: SDKConfig, message: string, event_id = 2) {
  config.onMessage?.({ source: "ai", role: "agent", message, event_id });
}
function stream(config: SDKConfig, text: string, event_id = 2) {
  config.onAgentChatResponsePart?.({ type: "start", text: "", event_id });
  config.onAgentChatResponsePart?.({ type: "delta", text, event_id });
  config.onAgentChatResponsePart?.({ type: "stop", text: "", event_id });
}
function messages() {
  return state.conversation.transcript
    .peek()
    .filter((entry) => entry.type === "message" && entry.role === "agent")
    .map((entry) => (entry.type === "message" ? entry.message : ""));
}

describe("upstream transcript fixes with managed sessions", () => {
  it("keeps the first real reply when the configured greeting is omitted", async () => {
    const config = await captureSession({ "agent-id": "text_only" });
    stream(config, "**Actual answer**");
    agentMessage(config, "Actual answer");
    expect(messages()).toEqual(["**Actual answer**"]);
  });

  it("suppresses only the configured greeting event in text mode", async () => {
    const config = await captureSession({ "agent-id": "text_only" });
    stream(config, "Agent response", 1);
    agentMessage(config, "Agent response", 1);
    agentMessage(config, "Actual answer", 2);
    expect(messages()).toEqual(["Actual answer"]);
  });

  it.each(["before-stop", "after-stop"])(
    "keeps streamed markdown when final text arrives %s",
    async (timing) => {
      const config = await captureSession({ "agent-id": "text_only" });
      config.onAgentChatResponsePart?.({ type: "start", text: "", event_id: 2 });
      config.onAgentChatResponsePart?.({
        type: "delta",
        text: "## Heading\n**Answer**",
        event_id: 2,
      });
      if (timing === "after-stop")
        config.onAgentChatResponsePart?.({ type: "stop", text: "", event_id: 2 });
      agentMessage(config, " Heading\nAnswer");
      if (timing === "before-stop")
        config.onAgentChatResponsePart?.({ type: "stop", text: "", event_id: 2 });
      expect(messages()).toEqual(["## Heading\n**Answer**"]);
    }
  );

  it.each(["forward", "reverse"])(
    "matches late tool-turn finals in %s arrival order",
    async (order) => {
      const config = await captureSession({ "agent-id": "text_only" });
      stream(config, "**Checking availability**");
      config.onAgentToolRequest?.({
        tool_name: "availability",
        tool_type: "webhook",
        tool_call_id: "tool-1",
        event_id: 2,
      });
      config.onAgentToolResponse?.({
        tool_call_id: "tool-1",
        is_error: false,
        event_id: 2,
        tool_name: "availability",
        tool_type: "webhook",
        is_called: true,
      });
      stream(config, "**Tuesday is available**");
      const finals = ["Checking availability", "Tuesday is available"];
      for (const text of order === "reverse" ? finals.reverse() : finals)
        agentMessage(config, text);
      expect(messages()).toEqual(["**Checking availability**", "**Tuesday is available**"]);
    }
  );

  it("does not duplicate a final response that arrives before its stream", async () => {
    const config = await captureSession({ "agent-id": "text_only" });
    agentMessage(config, "Answer");
    stream(config, "Answer");
    agentMessage(config, "Answer");
    expect(messages()).toEqual(["Answer"]);
  });

  it("ignores voice chat parts and retains the canonical voice transcript", async () => {
    const config = await captureSession();
    stream(config, "partial voice text");
    agentMessage(config, "Canonical voice text");
    expect(messages()).toEqual(["Canonical voice text"]);
    expect(state.conversation.transcript.peek()[0]).toMatchObject({ isText: false });
  });

  it("refreshes signed access on reconnect and clears pending streams", async () => {
    let calls = 0;
    Worker.use(
      http.get("https://api.askbenny.ca/elevenlabs/signed-url", () =>
        HttpResponse.json({
          body: {
            ...signedBody,
            signedUrl: `wss://api.elevenlabs.io/v1/convai/conversation?token=${++calls}`,
          },
        })
      )
    );
    const config = await captureSession();
    stream(config, "Unfinished old reply");
    await state.conversation.endSession();
    await state.conversation.startSession(container);
    const sdk = vi.mocked(Conversation.startSession);
    expect(calls).toBe(2);
    expect(sdk.mock.calls.map(([options]) => options.signedUrl)).toEqual([
      "wss://api.elevenlabs.io/v1/convai/conversation?token=1",
      "wss://api.elevenlabs.io/v1/convai/conversation?token=2",
    ]);
    agentMessage(sdk.mock.calls[1][0], "New reply");
    expect(messages()).toEqual(["New reply"]);
  });
});
