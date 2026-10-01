import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Orb } from "./Orb";

type Uniform = { name: string };

/** A WebGL2 stand-in that records draws and uniform writes. */
function fakeGl() {
  const uniforms = new Map<string, unknown>();
  const write = (location: Uniform | null, value: unknown) => {
    if (location) uniforms.set(location.name, value);
  };
  const gl = {
    FRAGMENT_SHADER: 1,
    VERTEX_SHADER: 2,
    canvas: { width: 64, height: 64 },
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    bindAttribLocation: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(),
    useProgram: vi.fn(),
    deleteProgram: vi.fn(),
    getUniformLocation: vi.fn((_program: unknown, name: string): Uniform => ({ name })),
    uniform1i: vi.fn(write),
    uniform1f: vi.fn(write),
    uniform1fv: vi.fn(write),
    uniform3fv: vi.fn(write),
    createTexture: vi.fn(),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    generateMipmap: vi.fn(),
    createBuffer: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    vertexAttribPointer: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    viewport: vi.fn(),
    drawArrays: vi.fn(),
  };
  return { gl, uniforms };
}

describe("Orb", () => {
  let now = 0;
  let frames: FrameRequestCallback[];
  let setVisible: ((entries: Partial<IntersectionObserverEntry>[]) => void) | undefined;

  beforeEach(() => {
    now = 0;
    frames = [];
    setVisible = undefined;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => frames.push(callback))
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
          setVisible = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function createOrb() {
    const fake = fakeGl();
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(fake.gl as unknown as WebGL2RenderingContext);
    return { orb: new Orb(canvas, "glass"), ...fake };
  }

  it("draws on demand without starting another animation loop", () => {
    const { orb, gl } = createOrb();

    orb.render();
    orb.render();

    expect(gl.drawArrays).toHaveBeenCalledTimes(2);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("pauses the animation while the orb is off screen and resumes when it returns", () => {
    const { gl } = createOrb();

    setVisible!([{ isIntersecting: false }]);
    frames.shift()?.(0);
    expect(gl.drawArrays).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);

    setVisible!([{ isIntersecting: true }]);
    expect(frames).toHaveLength(1);
    frames.shift()!(0);
    expect(gl.drawArrays).toHaveBeenCalledTimes(1);
  });

  it("eases the agent's volume into the shader and speeds up the motion while it speaks", () => {
    const { orb, uniforms } = createOrb();

    now = 50;
    orb.render();
    const quietPhase = uniforms.get("uPhase") as number;
    expect(quietPhase).toBeCloseTo(0.05);

    orb.updateVolume(0, 1);
    now = 100;
    orb.render();
    const volume = uniforms.get("uOutputVolume") as number;
    expect(volume).toBeGreaterThan(0.3);
    expect(volume).toBeLessThan(1);
    expect(uniforms.get("uInputVolume")).toBe(0);
    expect((uniforms.get("uPhase") as number) - quietPhase).toBeGreaterThan(0.05);
  });
});
