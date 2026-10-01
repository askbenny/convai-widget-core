// Pulse: a radial equalizer around a soft core. Bars collapse into a smooth
// ring at trigger sizes where they would be sub-pixel.

const float BARS = 40.0;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float e = energy();
  float t = uPhase;
  float px = fwidth(p.x);

  float u = a / TAU + 0.5;
  float cell = floor(u * BARS);
  float barAngle = (cell + 0.5) / BARS * TAU - PI;
  float h = snoise(vec3(cos(barAngle) * 1.3, sin(barAngle) * 1.3, t * 0.9 + uOffsets[0])) * 0.5 + 0.5;
  h = 0.02 + h * h * (0.07 + e * 0.3);

  // Rounded bar as a capsule in (tangential, radial) coordinates.
  float inner = 0.55;
  float cellWidth = r * TAU / BARS;
  float x = (fract(u * BARS) - 0.5) * cellWidth;
  float y = r - inner;
  float d = length(vec2(x, y - clamp(y, 0.0, h))) - cellWidth * 0.26;
  float bars = 1.0 - smoothstep(-px, px, d);

  float ringCenter = inner + 0.03 + e * 0.05;
  float ringWidth = 0.03 + e * 0.04;
  float ring = (1.0 - smoothstep(ringWidth - px, ringWidth + px, abs(r - ringCenter))) * 0.8;
  bars = mix(ring, bars, smoothstep(2.0, 5.0, cellWidth / px));

  vec3 barColor = tint(mix(uColor1, uColor2, 0.5 + 0.5 * sin(a + t * 0.5 + uOffsets[1])), 0.25);

  vec3 col = uColor1 * 0.14;
  col += barColor * exp(-abs(r - inner - h * 0.5) * 10.0) * (0.15 + e * 0.35);

  float coreRadius = 0.42 + e * 0.04;
  float core = 1.0 - smoothstep(coreRadius - px, coreRadius + px, r);
  float g = clamp(dot(p, normalize(vec2(-0.6, 0.8))) * 0.6 + 0.5, 0.0, 1.0);
  vec3 coreColor = mix(uColor1, uColor2, g);
  coreColor += tint(uColor2, 0.6) * exp(-length(p - vec2(-0.14, 0.16)) * 7.0) * 0.35;
  col = mix(col, coreColor, core);
  col = mix(col, barColor, bars);

  outColor = finalize(col);
}
