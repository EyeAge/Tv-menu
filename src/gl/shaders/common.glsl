// Shared header for every fragment shader: precision and the original's value-noise helpers.
// Ported from .reference/shaders/print.wgsl (ph, pnoise, pfbm); constants are copied verbatim.
precision highp float;
precision highp int;
precision highp sampler2D;

float ph(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.547);
}

float pnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = (f * f) * (vec2(3.0) - (2.0 * f));
  float a = ph(i);
  float b = ph(i + vec2(1.0, 0.0));
  float c = ph(i + vec2(0.0, 1.0));
  float d = ph(i + vec2(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

// The print uses 5 octaves (pfbm), the background 3 (fbm3).
float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  vec2 q = p;
  for (int i = 0; i < octaves; i++) {
    v = v + (a * pnoise(q));
    q = (q * 2.07) + vec2(13.0, 7.0);
    a = a * 0.5;
  }
  return v;
}
