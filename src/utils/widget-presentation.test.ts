import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWidgetPresentation, WidgetPresentationAuthRequiredError } from "./widget-presentation";

afterEach(() => vi.unstubAllGlobals());

const SERVER = "https://api.elevenlabs.io";
const widgetConfig = { variant: "compact", bg_color: "#ffffff" };
const presentation = (status: number, body: unknown = { widget_config: widgetConfig }) => ({
  ok: status < 400,
  status,
  json: async () => body,
});
const managedSession = (signedUrl: string) => ({
  ok: true,
  status: 200,
  json: async () => ({
    body: {
      schemaVersion: 2,
      agentId: "agent_1",
      branchId: "branch_1",
      signedUrl,
    },
  }),
});
const load = (options: Partial<Parameters<typeof loadWidgetPresentation>[0]> = {}) =>
  loadWidgetPresentation({
    agentId: "agent_1",
    serverUrl: SERVER,
    signal: new AbortController().signal,
    ...options,
  });

describe("widget presentation", () => {
  it("makes a single unsigned request for agents without authentication", async () => {
    const fetch = vi.fn().mockResolvedValue(presentation(200));
    vi.stubGlobal("fetch", fetch);

    await expect(load()).resolves.toEqual(widgetConfig);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(`${SERVER}/v1/convai/agents/agent_1/widget`);
  });

  it("signs the request with a managed session when the agent requires authentication", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(presentation(401, { detail: { code: "unauthorized" } }))
      .mockResolvedValueOnce(
        managedSession(
          "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_1&branch_id=branch_1&conversation_signature=sig%2B1"
        )
      )
      .mockResolvedValueOnce(presentation(200));
    vi.stubGlobal("fetch", fetch);

    await expect(load({ environment: "development" })).resolves.toEqual(widgetConfig);
    expect(fetch.mock.calls[1][0]).toBe(
      "https://api-dev.askbenny.ca/elevenlabs/signed-url?agentId=agent_1"
    );
    expect(fetch.mock.calls[2][0]).toBe(
      `${SERVER}/v1/convai/agents/agent_1/widget?conversation_signature=sig%2B1`
    );
  });

  it("keeps a host-supplied signature and never swaps it for a managed one", async () => {
    const fetch = vi.fn().mockResolvedValue(presentation(401));
    vi.stubGlobal("fetch", fetch);

    await expect(load({ conversationSignature: "host-sig" })).rejects.toBeInstanceOf(
      WidgetPresentationAuthRequiredError
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(
      `${SERVER}/v1/convai/agents/agent_1/widget?conversation_signature=host-sig`
    );
  });

  it("does not retry failures that are not authentication", async () => {
    const fetch = vi.fn().mockResolvedValue(presentation(500, {}));
    vi.stubGlobal("fetch", fetch);

    await expect(load()).rejects.toThrow("widget_config");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the managed session cannot be prepared", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(presentation(401))
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    vi.stubGlobal("fetch", fetch);

    await expect(load()).rejects.toThrow("preparing");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
