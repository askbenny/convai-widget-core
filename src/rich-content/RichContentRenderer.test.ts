import { describe, expect, it } from "vitest";
import { richContentEntry } from "./RichContentRenderer";

describe("richContentEntry", () => {
  it("finds the components the widget can render", () => {
    expect(richContentEntry("buttons")).toBeDefined();
    expect(richContentEntry("carousel")).toBeDefined();
  });

  it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "unknown"])(
    "treats %s as unknown so the fallback shows",
    (name) => {
      expect(richContentEntry(name)).toBeUndefined();
    }
  );
});
