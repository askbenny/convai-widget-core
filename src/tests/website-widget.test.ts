import { page } from "@vitest/browser/context";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Conversation } from "@elevenlabs/client";
import { http, HttpResponse } from "msw";
import { registerWidget } from "../index";
import { AGENTS, Worker } from "../mocks/browser";

const api = "https://api-dev.askbennypartners.com";
const requests: string[] = [];
const mounted: HTMLElement[] = [];

function mount(id: string, label: string) {
  const element = document.createElement("website-widget");
  element.setAttribute("widget-id", id);
  element.setAttribute("api-base-url", api);
  element.setAttribute("portal-hostname", "app.partner.test");
  element.setAttribute("aria-label", label);
  mounted.push(element);
  document.body.append(element);
  return element;
}

describe("website widget backend isolation", () => {
  beforeAll(async () => {
    registerWidget("website-widget");
    await Worker.start({ quiet: true });
  });
  afterAll(() => Worker.stop());
  afterEach(() => {
    mounted.splice(0).forEach((element) => element.remove());
    Worker.resetHandlers();
    requests.length = 0;
    vi.restoreAllMocks();
  });

  it("loads per-client appearance through the selected Partners API", async () => {
    Worker.use(
      http.get(`${api}/website-widgets/:id/config`, ({ request, params }) => {
        requests.push(request.url);
        return HttpResponse.json({
          widget_config: {
            ...AGENTS.basic,
            disable_banner: true,
            text_contents: { main_label: `Hello from ${params.id}` },
          },
        });
      })
    );
    mount("wgt_clinic", "Clinic widget");
    mount("wgt_salon", "Salon widget");
    await expect.poll(() => requests.length).toBe(2);
    expect(
      requests.every((url) => new URL(url).searchParams.get("hostname") === "app.partner.test")
    ).toBe(true);
    await expect.element(page.getByText("Hello from wgt_clinic")).toBeVisible();
    await expect.element(page.getByText("Hello from wgt_salon")).toBeVisible();
    await expect.element(page.getByText("AskBenny", { exact: true })).not.toBeInTheDocument();
  });

  it("does not contact legacy or provider endpoints when a widget is denied", async () => {
    Worker.use(
      http.all("*", ({ request }) => {
        if (request.destination !== "image") requests.push(request.url);
        return HttpResponse.json({ error: "Unavailable" }, { status: 403 });
      })
    );
    const element = mount("wgt_disabled", "Disabled widget");
    element.setAttribute("agent-id", "8ejsnHgt61Q30A38AIKr");
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect([...new Set(requests)]).toEqual([
      `${api}/website-widgets/wgt_disabled/config?hostname=app.partner.test`,
    ]);
    expect(element.shadowRoot?.querySelector("button")).toBeNull();
  });

  it("obtains fresh access at each start and carries server-issued website attribution", async () => {
    let sessions = 0;
    Worker.use(
      http.get(`${api}/website-widgets/:id/config`, () =>
        HttpResponse.json({
          widget_config: { ...AGENTS.basic, terms_html: "", disable_banner: true },
        })
      ),
      http.post(`${api}/website-widgets/:id/session`, () => {
        sessions++;
        return HttpResponse.json({
          signedUrl: `wss://voice.test/session-${sessions}`,
          dynamicVariables: { website_session_id: `session-${sessions}` },
          overrides: { agent: { firstMessage: "Welcome to this clinic", language: "en" } },
        });
      })
    );
    const start = vi.spyOn(Conversation, "startSession").mockImplementation(async (options) => {
      options.onStatusChange?.({ status: "connected" });
      return {
        getId: () => "conversation_1",
        isOpen: () => true,
        endSession: async () => options.onStatusChange?.({ status: "disconnected" }),
        getInputVolume: () => 0,
        getOutputVolume: () => 0,
      } as Conversation;
    });
    mount("wgt_clinic", "Clinic widget");
    const button = page.getByRole("button", { name: "Start a call", exact: true });
    await button.click();
    await expect.poll(() => start.mock.calls.length).toBe(1);
    expect(start.mock.calls[0][0]).toMatchObject({
      signedUrl: "wss://voice.test/session-1",
      overrides: { agent: { firstMessage: "Welcome to this clinic", language: "en" } },
      dynamicVariables: { website_session_id: "session-1" },
    });
    await page.getByRole("button", { name: "End", exact: true }).click();
    await button.click();
    await expect.poll(() => start.mock.calls.length).toBe(2);
    expect(start.mock.calls[1][0]).toMatchObject({
      signedUrl: "wss://voice.test/session-2",
      dynamicVariables: { website_session_id: "session-2" },
    });
  });
  it("does not open a connection after a widget is removed during authorization", async () => {
    let release!: () => void;
    let requested = false;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    Worker.use(
      http.get(`${api}/website-widgets/:id/config`, () =>
        HttpResponse.json({ widget_config: { ...AGENTS.basic, terms_html: "" } })
      ),
      http.post(`${api}/website-widgets/:id/session`, async () => {
        requested = true;
        await pending;
        return HttpResponse.json({
          signedUrl: "wss://voice.test/session",
          dynamicVariables: { website_session_id: "session-1" },
        });
      })
    );
    const start = vi.spyOn(Conversation, "startSession");
    const element = mount("wgt_clinic", "Clinic widget");
    await page.getByRole("button", { name: "Start a call", exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    element.remove();
    release();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(start).not.toHaveBeenCalled();
  });

  it("never treats an incomplete neutral embed as a legacy agent", async () => {
    Worker.use(
      http.all("*", ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json({ error: "Unexpected" }, { status: 403 });
      })
    );
    const element = document.createElement("website-widget");
    element.setAttribute("agent-id", "legacy-agent");
    mounted.push(element);
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(requests).toEqual([]);
  });
});
