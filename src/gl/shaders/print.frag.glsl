// Port of pattern_mask and fs_main from .reference/shaders/print.wgsl. Prefixed with common.glsl.
// Constants and expression order are copied verbatim; do not simplify.

uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec4 uPP; // kind, seed, scale, ink
uniform vec2 uRes; // print size in pixels

out vec4 fragColor;

// kind: 0 dots, 1 plus, 2 scales, 3 stripes, otherwise squares.
float pattern_mask(float kind, vec2 q, float density) {
  vec2 cell = fract(q) - vec2(0.5);
  float r = 0.12 + (0.3 * density);
  if (kind < 0.5) {
    return 1.0 - smoothstep(r - 0.04, r + 0.04, length(cell));
  } else if (kind < 1.5) {
    float a = step(abs(cell.x), 0.06) * step(abs(cell.y), r);
    float b = step(abs(cell.y), 0.06) * step(abs(cell.x), r);
    return max(a, b);
  } else if (kind < 2.5) {
    float row = floor(q.y);
    float sx = fract(q.x + (0.5 * (row - (2.0 * floor(row * 0.5))))) - 0.5;
    float sy = fract(q.y);
    float d = length(vec2(sx, sy - 1.0));
    return (1.0 - smoothstep(0.42, 0.5, d)) * smoothstep(0.3, 0.4, d);
  } else if (kind < 3.5) {
    return step(fract(q.x * 0.5), 0.25 + (0.35 * density));
  }
  float sq = max(abs(cell.x), abs(cell.y));
  return 1.0 - smoothstep(r - 0.03, r + 0.03, sq);
}

void main() {
  // The original's fragment position: origin top-left, pixel centers at .5.
  vec2 fragPos = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = fragPos / uRes;
  vec2 uv = vec2(p.x * (uRes.x / uRes.y), p.y) * 2.2;
  float seed = uPP.y;
  vec2 q = uv + vec2(seed * 3.1, seed * 1.7);

  float n0 = fbm(q * 1.15, 5);
  float n1 = fbm((q * 2.4) + vec2(5.0, 2.0), 5);
  float region = (n0 + (0.22 * sin((q.y * 3.5) + (n1 * 6.0)))) + (0.12 * sin((q.x * 2.2) + seed));

  vec3 col = uC0;
  float mA = smoothstep(0.4, 0.45, region);
  float mB = smoothstep(0.6, 0.65, region);
  col = mix(col, uC1, mA);
  col = mix(col, uC2, mB);

  float density = fbm((q * 1.8) + vec2(9.0, 4.0), 5);
  float pat = pattern_mask(uPP.x, q * uPP.z, density);
  float inA = mA * (1.0 - mB);
  col = mix(col, uC3, (pat * inA) * 0.9);

  float pat2 = pattern_mask(4.0 - uPP.x, ((q * uPP.z) * 1.7) + vec2(0.3), 0.35);
  col = mix(col, uC0, (pat2 * mB) * 0.35);

  float ink = smoothstep(0.64, 0.7, fbm((q * 1.5) + vec2(seed * 2.3, 9.0), 5));
  col = mix(col, uC0 * 0.25, ink * uPP.w);

  col = col * (0.94 + (0.08 * pnoise(q * 90.0)));
  fragColor = vec4(col, 1.0);
}
