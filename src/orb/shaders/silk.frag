// Silk: a slow mesh gradient with a satin sheen and fine grain.

void main() {
  vec2 uv = vUv;
  float e = energy();
  float t = uPhase * 0.22;

  vec2 q = uv + 0.1 * (1.0 + e * 1.5) * vec2(
    snoise(vec3(uv * 1.6, t + uOffsets[0])),
    snoise(vec3(uv * 1.6 + 7.3, t + uOffsets[1]))
  );

  vec3 colors[4];
  colors[0] = uColor1;
  colors[1] = uColor2;
  colors[2] = mix(uColor1, uColor2, 0.35) * 0.7;
  colors[3] = tint(uColor2, 0.6);

  vec3 sum = vec3(0.0);
  float weightSum = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float o = uOffsets[i + 2];
    vec2 anchor = 0.5 + 0.38 * vec2(
      sin(t * (1.0 + fi * 0.23) + o),
      cos(t * (0.8 + fi * 0.31) + o * 1.3)
    );
    float w = 1.0 / pow(distance(q, anchor) + 0.08, 2.2);
    sum += colors[i] * w;
    weightSum += w;
  }
  vec3 col = mix(sum / weightSum, mix(uColor1, uColor2, smoothstep(0.0, 1.2, uv.x + uv.y - 0.2)), 0.25);

  float sheen = snoise(vec3(q.x * 2.0 - q.y * 1.2, q.y * 0.8, t * 0.8 + uOffsets[6]));
  col += tint(uColor2, 0.8) * smoothstep(0.55, 1.0, sheen) * (0.1 + e * 0.25);

  outColor = finalize(col);
  outColor.rgb += (hash12(gl_FragCoord.xy * 1.7 + 11.0) - 0.5) * 0.04;
}
