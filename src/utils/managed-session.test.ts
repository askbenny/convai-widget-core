import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionConfig } from "@elevenlabs/client";
import { applyManagedSession, fetchWidgetSession, widgetApiOrigin } from "./managed-session";

afterEach(() => vi.unstubAllGlobals());
const session = {
  schemaVersion: 2 as const,
  agentId: "agent",
  branchId: "branch",
  signedUrl: "wss://api.elevenlabs.io/v1/convai/conversation?token=fresh",
  dynamicVariables: { widget_time_iso: "fresh" },
};
describe("managed widget sessions", () => {
  it("selects environments explicitly", () => {
    expect(widgetApiOrigin()).toBe("https://api.askbenny.ca");
    expect(widgetApiOrigin("production")).toBe("https://api.askbenny.ca");
    expect(widgetApiOrigin("development")).toBe("https://api-dev.askbenny.ca");
    expect(() => widgetApiOrigin("staging")).toThrow("Unsupported");
  });
  it("acquires a fresh URL on every start with encoded identity and no cache", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ body: { ...session, agentId: "a&b" } }),
    });
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    await fetchWidgetSession("a&b", "development", controller.signal);
    await fetchWidgetSession("a&b", "development", controller.signal);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(
      "https://api-dev.askbenny.ca/elevenlabs/signed-url?agentId=a%26b",
      { signal: controller.signal, cache: "no-store" }
    );
  });
  it.each([
    { ok: false, body: session },
    { ok: true, body: { signedUrl: session.signedUrl, agent: { prompt: { prompt: "SECRET" } } } },
    { ok: true, body: { ...session, branchId: undefined } },
    { ok: true, body: { ...session, agentId: "other" } },
    { ok: true, body: { ...session, signedUrl: "https://attacker.example" } },
  ])("fails closed for incompatible or failed responses", async ({ ok, body }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, json: async () => ({ body }) }));
    await expect(
      fetchWidgetSession("agent", undefined, new AbortController().signal)
    ).rejects.toThrow("preparing");
  });
  it("replaces event-supplied identity and prompt with the managed session", () => {
    const requested = {
      agentId: "other",
      connectionType: "webrtc",
      origin: "attacker",
      overrides: {
        agent: { prompt: { prompt: "SECRET" }, firstMessage: "Hello", language: "fr" },
        conversation: { textOnly: true },
      },
      dynamicVariables: { widget_time_iso: "stale", name: "Sam" },
    } as SessionConfig;
    const result = applyManagedSession(requested, session);
    expect(result).toMatchObject({
      signedUrl: session.signedUrl,
      connectionType: "websocket",
      dynamicVariables: { widget_time_iso: "fresh", name: "Sam" },
    });
    expect(result.agentId).toBeUndefined();
    expect(result.overrides?.agent?.prompt).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(result.overrides?.agent?.firstMessage).toBe("Hello");
  });
  it("cannot turn off a server-enforced text-only session", () => {
    const result = applyManagedSession(
      { signedUrl: "old", textOnly: false, overrides: { conversation: { textOnly: false } } },
      { ...session, conversation: { textOnly: true } }
    );
    expect(result.textOnly).toBe(true);
    expect(result.overrides?.conversation?.textOnly).toBe(true);
  });
});
