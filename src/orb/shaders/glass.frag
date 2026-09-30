// Glass: a lit glass sphere with slowly folding liquid inside.

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float e = energy();
  float t = uPhase * 0.18;

  float z = sqrt(max(1.0 - r * r, 0.0));
  vec3 n = normalize(vec3(p, z));

  // Sample the liquid on the rotating sphere surface so it reads as volume.
  vec3 s = n;
  s.xz = rot(t * 0.9) * s.xz;
  s.xy = rot(t * 0.4) * s.xy;
  vec3 w = s * 0.7 + vec3(uOffsets[0], uOffsets[1], uOffsets[2]);
  vec3 warp = vec3(
    snoise(w + vec3(0.0, 0.0, t)),
    snoise(w + vec3(5.2, 1.3, -t)),
    snoise(w + vec3(1.7, 9.2, t * 0.5))
  );
  vec3 q = w + warp * (0.7 + e * 0.8);
  float f = smoothstep(0.15, 0.85, (snoise(q) * 0.8 + snoise(q * 2.1 + 3.0) * 0.2) * 0.5 + 0.5);

  vec3 col = mix(uColor1 * 0.18, uColor1, smoothstep(0.0, 0.5, f));
  col = mix(col, uColor2, smoothstep(0.45, 1.0, f));

  // Bright filaments where the liquid folds over itself.
  float filament = smoothstep(0.05, 0.0, abs(f - 0.6));
  col += tint(uColor2, 0.5) * filament * (0.25 + e * 0.5);

  // Light from within, stronger while speaking.
  col += uColor2 * pow(z, 4.0) * (0.15 + e * 0.35);

  // Edge absorption, then a fresnel rim.
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.6, z));
  col = mix(col, tint(uColor2, 0.65), pow(1.0 - z, 2.5) * 0.55);

  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 key = normalize(vec3(-0.45, 0.55, 0.7));
  vec3 fill = normalize(vec3(0.6, -0.5, 0.6));
  col += pow(max(dot(reflect(-key, n), view), 0.0), 40.0) * 0.9;
  col += tint(uColor2, 0.4) * pow(max(dot(reflect(-fill, n), view), 0.0), 12.0) * 0.15;

  outColor = finalize(col);
}
