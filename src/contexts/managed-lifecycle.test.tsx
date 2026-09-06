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
