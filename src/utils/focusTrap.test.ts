import { describe, expect, it } from "vitest";
import { trappedFocusTarget } from "./focusTrap";

describe("trappedFocusTarget", () => {
  const buttons = ["cancel", "end"];

  it("wraps forward from the last control to the first", () => {
    expect(trappedFocusTarget(buttons, "end", false)).toBe("cancel");
  });

  it("wraps backward from the first control to the last", () => {
    expect(trappedFocusTarget(buttons, "cancel", true)).toBe("end");
  });

  it("lets Tab move between controls inside the dialog", () => {
    expect(trappedFocusTarget(buttons, "cancel", false)).toBeNull();
    expect(trappedFocusTarget(buttons, "end", true)).toBeNull();
  });

  it("pulls focus back in when it is outside the dialog", () => {
    expect(trappedFocusTarget(buttons, "page-link", false)).toBe("cancel");
    expect(trappedFocusTarget(buttons, null, true)).toBe("end");
  });

  it("does nothing without focusable controls", () => {
    expect(trappedFocusTarget([], "anything", false)).toBeNull();
  });
});
