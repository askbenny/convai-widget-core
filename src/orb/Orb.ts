import vertexCode from "./OrbShader.vert?raw";
import { DEFAULT_ORB_STYLE, getOrbFragmentShader, OrbStyle } from "./styles";

const POSITION_LOCATION = 0;
const QUAD_POSITIONS = new Float32Array([-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]);
const PERLIN_NOISE = "https://storage.googleapis.com/eleven-public-cdn/images/perlin-noise.png";

export class Orb {
  private static noiseImage?: HTMLImageElement;

  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private style: OrbStyle;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
  private startTime: number;
  private lastFrame: number;
  private phase = 0;
  private inputVolume = 0;
  private outputVolume = 0;
  private targetInputVolume = 0;
  private targetOutputVolume = 0;
  private rafId: number | null = null;
  private visible = true;
  private resizeObserver?: ResizeObserver;
  private visibilityObserver?: IntersectionObserver;
  private colorA: number[] = [0, 0, 0];
  private colorB: number[] = [0, 0, 0];
  private offsets = new Float32Array(7).map(() => Math.random() * Math.PI * 2);

  public constructor(canvas: HTMLCanvasElement, style: OrbStyle = DEFAULT_ORB_STYLE) {
    const gl = canvas.getContext("webgl2", {
      depth: false,
      stencil: false,
    })!;

    this.gl = gl;
    this.style = style;
    this.program = this.setupProgram(getOrbFragmentShader(style), vertexCode);
    if (import.meta.hot) {
      import.meta.hot.accept("./styles", (module) => {
        if (!this.gl || !module) return;
        this.program = this.setupProgram(module.getOrbFragmentShader(this.style), vertexCode);
      });
    }

    const noise = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, noise);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([128, 128, 128, 255])
    );
    if (style === "classic") {
      this.loadNoiseImage();
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_POSITIONS, gl.STATIC_DRAW);
    gl.vertexAttribPointer(POSITION_LOCATION, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(POSITION_LOCATION);

    this.updateColors("#2792DC", "#9CE6E6");

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const size = entry.devicePixelContentBoxSize
        ? entry.devicePixelContentBoxSize[0]
        : entry.contentBoxSize[0];

      canvas.width = Math.min(512, size.inlineSize);
      canvas.height = Math.min(512, size.blockSize);
      this.updateViewport();
    });

    const parent = canvas.parentElement;
    if (parent) {
      try {
        this.resizeObserver.observe(parent, {
          box: "device-pixel-content-box",
        });
      } catch (e) {
        this.resizeObserver.observe(parent);
      }
    }

    // Pause drawing while the orb is off screen or inside a hidden container.
    if (typeof IntersectionObserver !== "undefined") {
      this.visibilityObserver = new IntersectionObserver((entries) => {
        this.setVisible(entries[entries.length - 1]?.isIntersecting ?? true);
      });
      this.visibilityObserver.observe(canvas);
    }

    this.startTime = performance.now();
    this.lastFrame = this.startTime;
    this.rafId = requestAnimationFrame(this.loop);
  }

  private setVisible(visible: boolean) {
    if (!this.gl || visible === this.visible) return;

    this.visible = visible;
    if (!visible) {
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);
      this.rafId = null;
    } else if (this.rafId === null) {
      this.lastFrame = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  public dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }

    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    this.gl = null as unknown as WebGL2RenderingContext;
    this.program = null as unknown as WebGLProgram;
  }

  public updateViewport() {
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
  }

  public setStyle(style: OrbStyle) {
    if (!this.gl || style === this.style) return;

    this.style = style;
    this.program = this.setupProgram(getOrbFragmentShader(style), vertexCode);
    if (style === "classic") {
      this.loadNoiseImage();
    }
  }

  public updateColors(a: string, b: string) {
    if (!this.gl) return;

    this.colorA = this.updateColor("uColor1", a) ?? this.colorA;
    this.colorB = this.updateColor("uColor2", b) ?? this.colorB;
  }

  /** Volumes are 0..1 and are smoothed per frame before reaching the shader. */
  public updateVolume(input: number, output: number) {
    this.targetInputVolume = input;
    this.targetOutputVolume = output;
  }

  private uniform(name: string) {
    if (!this.uniforms.has(name)) {
      this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.uniforms.get(name)!;
  }

  private updateColor(name: string, hex: string) {
    try {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      // Convert sRGB to linear to match our Three.js implementation
      const color = [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)];
      this.gl.uniform3fv(this.uniform(name), color);
      return color;
    } catch (e) {
      console.error(`[ConversationalAI] Failed to parse ${hex} as color:`, e);
    }
  }

  private setupProgram(fragmentCode: string, vertexCode: string) {
    const fragment = this.getShader(this.gl.FRAGMENT_SHADER, fragmentCode);
    const vertex = this.getShader(this.gl.VERTEX_SHADER, vertexCode);
    if (!fragment || !vertex) {
      throw new Error("Failed to compile shaders");
    }

    const previous = this.program;
    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, fragment);
    this.gl.attachShader(program, vertex);
    this.gl.bindAttribLocation(program, POSITION_LOCATION, "position");
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      if (import.meta.env.DEV) {
        console.error(this.gl.getProgramInfoLog(program));
      }
      throw new Error("Failed to link program");
    }

    this.program = program;
    this.uniforms.clear();
    this.gl.useProgram(program);
    this.gl.uniform1i(this.uniform("uPerlinTexture"), 0);
    this.gl.uniform1fv(this.uniform("uOffsets"), this.offsets);
    this.gl.uniform3fv(this.uniform("uColor1"), this.colorA);
    this.gl.uniform3fv(this.uniform("uColor2"), this.colorB);
    if (previous) {
      this.gl.deleteProgram(previous);
    }

    return program;
  }

  private getShader(type: GLenum, source: string): WebGLShader | null {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      if (import.meta.env.DEV) {
        console.error(this.gl.getShaderInfoLog(shader));
      }
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private loadNoiseImage() {
    if (!Orb.noiseImage) {
      Orb.noiseImage = new Image();
      Orb.noiseImage.crossOrigin = "anonymous";
      Orb.noiseImage.src = PERLIN_NOISE;
    }
    if (Orb.noiseImage.complete) {
      this.copyNoiseImage();
    } else {
      Orb.noiseImage.addEventListener("load", this.copyNoiseImage);
    }
  }

  private copyNoiseImage = () => {
    if (!this.gl || !Orb.noiseImage) {
      return;
    }

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      Orb.noiseImage
    );
    this.gl.generateMipmap(this.gl.TEXTURE_2D);
  };

  public toDataURL = () => {
    return (this.gl.canvas as HTMLCanvasElement).toDataURL("image/png");
  };

  /** Draws a single frame. The animation loop runs on its own. */
  public render = () => {
    if (!this.gl) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;

    // Fast attack, slow release so the orb swells with syllables and settles gently.
    const smooth = (current: number, target: number) =>
      current + (target - current) * (1 - Math.exp(-dt * (target > current ? 18 : 5)));
    this.inputVolume = smooth(this.inputVolume, this.targetInputVolume);
    this.outputVolume = smooth(this.outputVolume, this.targetOutputVolume);
    this.phase += dt * (1 + Math.max(this.inputVolume, this.outputVolume) * 1.5);

    const gl = this.gl;
    gl.uniform1f(this.uniform("uTime"), (now - this.startTime) / 1000);
    gl.uniform1f(this.uniform("uPhase"), this.phase);
    gl.uniform1f(this.uniform("uInputVolume"), this.inputVolume);
    gl.uniform1f(this.uniform("uOutputVolume"), this.outputVolume);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  private loop = () => {
    if (!this.gl || !this.visible) {
      this.rafId = null;
      return;
    }

    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };
}
