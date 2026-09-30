import classic from "./OrbShader.frag?raw";
import common from "./shaders/common.glsl?raw";
import glass from "./shaders/glass.frag?raw";
import halo from "./shaders/halo.frag?raw";
import blob from "./shaders/blob.frag?raw";
import silk from "./shaders/silk.frag?raw";
import vortex from "./shaders/vortex.frag?raw";
import pulse from "./shaders/pulse.frag?raw";

const STYLE_BODIES = { glass, halo, blob, silk, vortex, pulse };

export const ORB_STYLES = [
  ...(Object.keys(STYLE_BODIES) as (keyof typeof STYLE_BODIES)[]),
  "classic",
] as const;

export type OrbStyle = (typeof ORB_STYLES)[number];

export const DEFAULT_ORB_STYLE: OrbStyle = "glass";

export function getOrbFragmentShader(style: OrbStyle): string {
  return style === "classic" ? classic : `${common}\n${STYLE_BODIES[style]}`;
}
