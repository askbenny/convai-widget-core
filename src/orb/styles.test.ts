import { describe, expect, it } from "vitest";
import { getOrbFragmentShader, ORB_STYLES } from "./styles";

/** The two edge arguments of every smoothstep(edge0, edge1, x) call. */
function smoothstepEdges(source: string): [string, string][] {
  const edges: [string, string][] = [];
  for (const match of source.matchAll(/smoothstep\(/g)) {
    const args: string[] = [];
    let depth = 0;
    let current = "";
    for (const char of source.slice(match.index! + match[0].length)) {
      if (char === "(") depth++;
      if (char === ")" && depth-- === 0) break;
      if (char === "," && depth === 0) {
        args.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    edges.push([args[0], args[1]]);
  }
  return edges;
}

const isNumber = (value: string) => /^-?\d+(\.\d+)?$/.test(value);

describe("orb shaders", () => {
  // GLSL leaves smoothstep undefined when edge0 >= edge1, so a falling edge must be
  // written as 1.0 - smoothstep(low, high, x).
  it.each(ORB_STYLES)("%s only uses smoothstep with ascending edges", (style) => {
    for (const edges of smoothstepEdges(getOrbFragmentShader(style))) {
      const [edge0, edge1] = edges.map((edge) => edge.replace(/\s/g, ""));
      const call = `smoothstep(${edge0}, ${edge1}, ...)`;
      if (isNumber(edge0) && isNumber(edge1)) {
        expect(Number(edge0), call).toBeLessThan(Number(edge1));
      }
      // Symbolic falling edges: (x + w, x - w), (w, -w), (x, 0.0) and (1.0, 1.0 - w).
      expect(edge0.endsWith("+px"), call).toBe(false);
      expect(edge1.startsWith("-"), call).toBe(false);
      expect(!isNumber(edge0) && edge1 === "0.0", call).toBe(false);
      expect(edge0 === "1.0" && edge1.startsWith("1.0-"), call).toBe(false);
    }
  });
});
