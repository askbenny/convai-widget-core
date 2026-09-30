// Halo: an eclipse-like ring of light that breathes and warps with the voice.

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec2 dir = vec2(cos(a), sin(a));
  float e = energy();
  float t = uPhase;

  vec3 col = mix(uColor1 * 0.30, uColor1 * 0.07, vUv.y);
  col += uColor2 * exp(-r * r * 5.0) * (0.10 + e * 0.35);

  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float wobble = snoise(vec3(dir * 1.1, t * 0.35 + uOffsets[i] * 3.0)) * (0.035 + e * 0.12);
    float radius = 0.6 + fi * 0.035 + wobble + e * 0.05;
    float d = abs(r - radius);

    float glow = exp(-d * mix(26.0, 15.0, e));
    float core = exp(-d * 90.0);
    float spin = i == 0 ? 0.9 : -0.7;
    float g = 0.5 + 0.5 * sin(a * (1.0 + fi) + t * spin + uOffsets[4 + i]);
    vec3 ringColor = mix(uColor1, uColor2, g);

    col += ringColor * glow * (0.55 - fi * 0.2) * (1.0 + e);
    col += tint(uColor2, 0.7) * core * (0.7 - fi * 0.35);
  }

  outColor = finalize(col);
}
