// Blob: glossy droplets that drift, merge and swell with the voice.

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float e = energy();
  float t = uPhase * 0.55;

  float field = 0.0;
  vec2 gradient = vec2(0.0);
  vec3 tintSum = vec3(0.0);
  float tintWeight = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float o = uOffsets[i];
    vec2 center = vec2(
      sin(t * (0.5 + fi * 0.09) + o),
      cos(t * (0.41 + fi * 0.07) + o * 1.7)
    ) * (0.5 - e * 0.12);
    float radius = 0.21 + 0.05 * sin(t * 1.3 + o * 2.0) + e * 0.1;
    vec2 d = p - center;
    float k = radius * radius / (dot(d, d) + 1e-4);
    field += k;
    gradient += -2.0 * k * k / (radius * radius) * d;
    float w = min(k, 1.2);
    tintSum += w * (mod(fi, 2.0) < 1.0 ? uColor1 : uColor2);
    tintWeight += w;
  }
  vec3 blobColor = tintSum / max(tintWeight, 1e-4);

  vec3 n = normalize(vec3(-gradient / (field * field) * 0.2, 1.0));
  vec3 light = normalize(vec3(-0.4, 0.5, 0.8));
  float diffuse = clamp(dot(n, light), 0.0, 1.0);
  float spec = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 50.0);
  vec3 lit = blobColor * (0.55 + 0.6 * diffuse) + spec * 0.4;

  vec3 bg = mix(tint(uColor2, 0.78), tint(uColor2, 0.5), r);
  bg += blobColor * smoothstep(0.35, 1.0, field) * 0.25;

  // Keep the edges distinct; smoothstep is undefined when they are equal.
  float aa = clamp(fwidth(field), 1e-4, 0.5);
  float inside = smoothstep(1.0 - aa, 1.0 + aa, field);

  outColor = finalize(mix(bg, lit, inside));
}
