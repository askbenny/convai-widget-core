// Vortex: spiral fibers pulled toward a glowing core.

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec2 dir = vec2(cos(a), sin(a));
  float e = energy();
  float t = uPhase;

  float twist = a + r * (2.2 + 0.6 * sin(t * 0.15 + uOffsets[0])) - t * 0.25;
  float fibers = 0.5 + 0.5 * sin(twist * 7.0);
  float streaks = snoise(vec3(dir * 4.0, r * 2.0 - t * 0.3 + uOffsets[1])) * 0.5 + 0.5;
  float pattern = mix(fibers, streaks, 0.45);

  vec3 col = mix(uColor1 * 0.8, uColor2, pattern);
  col *= mix(1.0, 0.3, smoothstep(0.55, 1.0, r));

  float coreRadius = 0.16 + e * 0.1;
  col += tint(uColor2, 0.55) * exp(-pow(max(r - coreRadius, 0.0) * 6.0, 1.5)) * (0.45 + e * 0.6);
  col += tint(uColor2, 0.85) * (1.0 - smoothstep(0.0, coreRadius, r)) * 0.6;

  outColor = finalize(col);
}
