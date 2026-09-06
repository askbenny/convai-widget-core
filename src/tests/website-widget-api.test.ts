import { describe, expect, it } from "vitest";
import { websiteWidgetUrl } from "../utils/website-widget-api";
describe("website API routing", () => {
  it("permits local loopback APIs for portal development", () => {
    expect(
      websiteWidgetUrl("http://127.0.0.1:3999", "wgt_client", "app.localhost:3100", "config")
    ).toBe("http://127.0.0.1:3999/website-widgets/wgt_client/config?hostname=app.localhost%3A3100");
  });
  it("refuses insecure remote APIs and URLs containing credentials", () => {
    expect(() =>
      websiteWidgetUrl("http://api.example.com", "wgt_client", "app.test", "config")
    ).toThrow();
    expect(() =>
      websiteWidgetUrl("https://user:pass@api.example.com", "wgt_client", "app.test", "config")
    ).toThrow();
  });
});
