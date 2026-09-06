import { describe, expect, it } from "vitest";
import { registerWidget } from "../index";

describe("compatible widget registration", () => {
  it("keeps the legacy element when another script registers it again", () => {
    registerWidget();
    const original = customElements.get("askbenny-convai");
    expect(() => registerWidget()).not.toThrow();
    expect(customElements.get("askbenny-convai")).toBe(original);
  });

  it("registers the neutral element independently of the legacy element", () => {
    registerWidget("website-widget");
    expect(customElements.get("website-widget")).toBeDefined();
    expect(customElements.get("website-widget")).not.toBe(customElements.get("askbenny-convai"));
    expect(() => registerWidget("website-widget")).not.toThrow();
  });
});
