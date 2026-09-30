/**
 * Dev-only gallery for comparing orb styles side by side with the real Orb
 * renderer, at the sizes the widget uses, with simulated or live audio.
 */
import { Orb } from "./orb/Orb";
import { ORB_STYLES, OrbStyle } from "./orb/styles";

const DESCRIPTIONS: Record<OrbStyle, string> = {
  glass: "Lit glass sphere with folding liquid inside. Premium, dimensional.",
  halo: "Eclipse ring of light that warps and brightens with the voice.",
  blob: "Glossy droplets that drift, merge and swell. Friendly, playful.",
  silk: "Slow mesh gradient with satin sheen and grain. Calm, editorial.",
  vortex: "Spiral fibers pulled into a glowing core. Energetic, focused.",
  pulse: "Radial equalizer around a soft core. Reads instantly as voice.",
  classic: "Current default: the ElevenLabs orb, for comparison.",
};

const PALETTES = [
  { name: "Benny Terracotta", c1: "#922B21", c2: "#F2B9A6" },
  { name: "Benny Ember", c1: "#6E1D16", c2: "#F4E1DD" },
  { name: "Evergreen", c1: "#1F5A3D", c2: "#A8DDBE" },
  { name: "Ocean", c1: "#1E40AF", c2: "#60A5FA" },
  { name: "Violet", c1: "#6D28D9", c2: "#C4B5FD" },
  { name: "Graphite", c1: "#374151", c2: "#D1D5DB" },
  { name: "ElevenLabs default", c1: "#2792DC", c2: "#9CE6E6" },
];

type Mode = "idle" | "listening" | "speaking" | "mic";

const state = {
  palette: PALETTES[0],
  mode: "speaking" as Mode,
  dark: false,
};

const orbs: { orb: Orb; frame: HTMLElement; ring: HTMLElement }[] = [];

document.head.insertAdjacentHTML(
  "beforeend",
  `<style>
  :root { --bg:#F6F2EA; --card:#FFFFFF; --ink:#1C1917; --muted:#78716C; --line:#E7E0D3; --chip:#EFE9DE; }
  body.dark { --bg:#0E0C0A; --card:#171412; --ink:#F5F0E8; --muted:#A8A29E; --line:#2A2521; --chip:#221E1B; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.45 ui-sans-serif, system-ui, -apple-system, sans-serif; transition: background .3s; }
  header { position:sticky; top:0; z-index:2; background:color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(10px); border-bottom:1px solid var(--line); padding:16px 24px; display:flex; flex-wrap:wrap; gap:16px 28px; align-items:center; }
  h1 { font-size:18px; margin:0; letter-spacing:-.01em; }
  .group { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
  .group span { color:var(--muted); font-size:12px; margin-right:4px; text-transform:uppercase; letter-spacing:.06em; }
  button.chip { border:1px solid var(--line); background:var(--chip); color:var(--ink); border-radius:999px; padding:6px 12px; cursor:pointer; font:inherit; font-size:13px; display:inline-flex; gap:6px; align-items:center; }
  button.chip[aria-pressed=true] { background:var(--ink); color:var(--bg); border-color:var(--ink); }
  .sw { width:12px; height:12px; border-radius:50%; display:inline-block; }
  input[type=color] { width:28px; height:28px; border:none; background:none; padding:0; cursor:pointer; }
  main { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:20px; padding:24px; max-width:1400px; margin:0 auto; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:20px; overflow:hidden; display:flex; flex-direction:column; }
  .stage { height:260px; display:grid; place-items:center; }
  .avatar { position:relative; width:var(--size); height:var(--size); flex-shrink:0; }
  .avatar .ring { position:absolute; inset:0; border-radius:50%; background:var(--line); will-change:transform; }
  .avatar .frame { position:absolute; inset:0; border-radius:50%; overflow:hidden; will-change:transform; }
  .avatar canvas { width:100%; height:100%; display:block; }
  .trigger { margin:0 auto 20px; display:flex; align-items:center; gap:10px; padding:6px 6px 6px 8px; background:var(--card); border:1px solid var(--line); border-radius:999px; box-shadow:0 6px 24px rgba(0,0,0,.08); }
  .trigger .label { font-size:13px; padding-right:4px; white-space:nowrap; }
  .trigger .cta { background:var(--ink); color:var(--bg); border-radius:999px; padding:7px 12px; font-size:12px; white-space:nowrap; }
  .meta { border-top:1px solid var(--line); padding:14px 18px 16px; }
  .meta h2 { margin:0 0 2px; font-size:15px; display:flex; justify-content:space-between; align-items:baseline; }
  .meta code { font-size:11px; color:var(--muted); font-weight:400; }
  .meta p { margin:0; color:var(--muted); font-size:13px; }
  .card.current { opacity:.8; }
  .card.current .meta h2::after { content:"current"; font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); border:1px solid var(--line); border-radius:999px; padding:1px 7px; margin-left:auto; }
  .card.current .meta h2 code { display:none; }
  </style>`
);

document.body.innerHTML = `
  <header>
    <h1>Orb styles</h1>
    <div class="group" id="modes"><span>State</span></div>
    <div class="group" id="palettes"><span>Colors</span></div>
    <div class="group"><span>Custom</span><input type="color" id="c1"><input type="color" id="c2"></div>
    <div class="group"><button class="chip" id="theme">Dark page</button></div>
  </header>
  <main id="grid"></main>
`;

function avatar(size: number) {
  const el = document.createElement("div");
  el.className = "avatar";
  el.style.setProperty("--size", `${size}px`);
  el.innerHTML = `<div class="ring"></div><div class="frame"><canvas></canvas></div>`;
  return el;
}

const grid = document.getElementById("grid")!;
for (const style of ORB_STYLES) {
  const card = document.createElement("article");
  card.className = `card${style === "classic" ? " current" : ""}`;

  const stage = document.createElement("div");
  stage.className = "stage";
  const large = avatar(192);
  stage.append(large);

  const trigger = document.createElement("div");
  trigger.className = "trigger";
  const small = avatar(36);
  trigger.append(small);
  trigger.insertAdjacentHTML(
    "beforeend",
    `<span class="label">Need help?</span><span class="cta">Start a call</span>`
  );

  const meta = document.createElement("div");
  meta.className = "meta";
  const title = style[0].toUpperCase() + style.slice(1);
  meta.innerHTML = `<h2>${title} <code>${style}</code></h2><p>${DESCRIPTIONS[style]}</p>`;

  card.append(stage, trigger, meta);
  grid.append(card);

  for (const el of [large, small]) {
    const orb = new Orb(el.querySelector("canvas")!, style);
    orbs.push({
      orb,
      frame: el.querySelector(".frame")!,
      ring: el.querySelector(".ring")!,
    });
  }
}

function button(label: string, onClick: () => void, swatch?: [string, string]) {
  const b = document.createElement("button");
  b.className = "chip";
  if (swatch) {
    b.innerHTML = `<i class="sw" style="background:linear-gradient(135deg, ${swatch[0]} 50%, ${swatch[1]} 50%)"></i>`;
  }
  b.append(label);
  b.addEventListener("click", onClick);
  return b;
}

function syncPressed(container: HTMLElement, active: HTMLElement) {
  container
    .querySelectorAll("button")
    .forEach((b) => b.setAttribute("aria-pressed", String(b === active)));
}

const c1Input = document.getElementById("c1") as HTMLInputElement;
const c2Input = document.getElementById("c2") as HTMLInputElement;

function applyColors(c1: string, c2: string) {
  c1Input.value = c1;
  c2Input.value = c2;
  for (const { orb } of orbs) orb.updateColors(c1, c2);
}

const palettes = document.getElementById("palettes")!;
for (const palette of PALETTES) {
  const b = button(
    palette.name,
    () => {
      state.palette = palette;
      applyColors(palette.c1, palette.c2);
      syncPressed(palettes, b);
    },
    [palette.c1, palette.c2]
  );
  palettes.append(b);
  if (palette === state.palette) syncPressed(palettes, b);
}
for (const input of [c1Input, c2Input]) {
  input.addEventListener("input", () => {
    applyColors(c1Input.value, c2Input.value);
    syncPressed(palettes, input);
  });
}
applyColors(state.palette.c1, state.palette.c2);

let micLevel: (() => number) | null = null;
async function enableMic() {
  if (micLevel) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  micLevel = () => {
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += v * v;
    return Math.min(1, Math.sqrt(sum / data.length) * 6);
  };
}

const modes = document.getElementById("modes")!;
const MODE_LABELS: Record<Mode, string> = {
  idle: "Idle",
  listening: "Listening",
  speaking: "Speaking",
  mic: "Live mic",
};
for (const mode of Object.keys(MODE_LABELS) as Mode[]) {
  const b = button(MODE_LABELS[mode], async () => {
    if (mode === "mic") {
      try {
        await enableMic();
      } catch {
        b.textContent = "Mic blocked";
        return;
      }
    }
    state.mode = mode;
    syncPressed(modes, b);
  });
  modes.append(b);
  if (mode === state.mode) syncPressed(modes, b);
}

document.getElementById("theme")!.addEventListener("click", (e) => {
  state.dark = !state.dark;
  document.body.classList.toggle("dark", state.dark);
  (e.currentTarget as HTMLElement).setAttribute("aria-pressed", String(state.dark));
});

// Syllable-like envelope with pauses between phrases.
function speech(t: number, seed: number) {
  const phrase = Math.sin(t * 0.8 + seed) > -0.35 ? 1 : 0;
  const syllables =
    Math.abs(Math.sin(t * 7.3 + seed)) * 0.6 + Math.abs(Math.sin(t * 3.1 + seed * 2)) * 0.4;
  return phrase * Math.min(1, syllables * (0.75 + 0.25 * Math.sin(t * 1.7)));
}

// Mirrors Avatar.tsx: the ring grows with the agent's voice and the orb
// shrinks slightly with the user's voice.
function tick() {
  const t = performance.now() / 1000;
  let input = 0;
  let output = 0;
  if (state.mode === "listening") input = speech(t, 1.3) * 0.7;
  if (state.mode === "speaking") output = speech(t, 0);
  if (state.mode === "mic" && micLevel) output = micLevel();

  for (const { orb, frame, ring } of orbs) {
    orb.updateVolume(input, output);
    ring.style.transform = `scale(${1 + output * 0.4})`;
    frame.style.transform = `scale(${1 - input * 0.4})`;
  }
  requestAnimationFrame(tick);
}
tick();
