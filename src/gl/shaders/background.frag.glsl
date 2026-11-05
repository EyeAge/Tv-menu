// Port of blurred and fs_main from .reference/shaders/background.wgsl. Prefixed with common.glsl
// (the original's fbm3_ is fbm(p, 3)). Constants and expression order are copied verbatim; do not
// simplify. Renders into the quarter-resolution background target, stored upright like the prints.

uniform sampler2D uTexA; // print of the app the wipe starts from
uniform sampler2D uTexB; // print of the app the wipe ends on (the settled image)
uniform float uTime;
uniform float uT; // wipe progress, 1 when no wipe is running
uniform float uDir;
uniform float uSeed;
uniform vec2 uRes; // background target size in pixels
uniform vec2 uGlowPos; // glow center in the original uv (origin top-left)
uniform vec4 uGlow;

out vec4 fragColor;

// Texture lookup at the original's uv (origin top-left); prints wrap with mirrored repeat.
vec3 sampleAt(sampler2D tex, vec2 uv) {
  return texture(tex, vec2(uv.x, 1.0 - uv.y)).xyz;
}

vec3 blurred(sampler2D tex, vec2 uv, float r) {
  vec3 c = sampleAt(tex, uv) * 2.0;
  c = c + sampleAt(tex, uv + vec2(r, 0.0));
  c = c + sampleAt(tex, uv - vec2(r, 0.0));
  c = c + sampleAt(tex, uv + vec2(0.0, r));
  c = c + sampleAt(tex, uv - vec2(0.0, r));
  c = c + sampleAt(tex, uv + (vec2(r, r) * 0.7));
  c = c + sampleAt(tex, uv - (vec2(r, r) * 0.7));
  return c / vec3(8.0);
}

void main() {
  vec2 res = uRes;
  // The original's fragment position: origin top-left, pixel centers at .5.
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / res;
  float aspect = uRes.x / uRes.y;
  float t = uTime;
  vec2 pa = vec2(p.x * aspect, p.y);
  float foldX = fbm((pa * 1.4) + vec2(t * 0.03, 0.0), 3);
  float foldY = fbm((pa * 1.4) + vec2(7.0, t * 0.02), 3);
  vec2 fold = vec2(foldX - 0.5, foldY - 0.5) * 0.16;
  vec2 uv = ((p * vec2(0.62, 0.62)) + fold) + vec2(0.18, 0.16);

  float moving = 1.0 - abs((2.0 * uT) - 1.0);
  float r = 0.012 + (0.014 * moving);
  vec3 oldCol = blurred(uTexA, uv, r);
  vec3 newCol = blurred(uTexB, uv + vec2(0.21, 0.07), r);

  // WGSL select(f, t, cond) yields t when cond holds.
  float ramp = uDir < 0.0 ? p.x : (1.0 - p.x);
  float wipeNoise = fbm((pa * 2.6) + vec2(uSeed * 7.0, uSeed * 3.0), 3);
  float m = (ramp * 0.55) + (wipeNoise * 0.9);
  float edge = (uT * 1.75) - 0.15;
  float keepOld = smoothstep(edge - 0.07, edge + 0.07, m);
  vec3 col = mix(newCol, oldCol, keepOld);
  // pow with a negative base is undefined in GLSL ES (often NaN). abs() yields the square the
  // original evidently computes: once settled m < edge everywhere, and its image is not black.
  float band = exp(-(pow(abs((m - edge) * 18.0), 2.0))) * pow(moving, 0.6);
  col = col + ((vec3(0.55, 0.5335, 0.50600004) + (uGlow.xyz * 0.6)) * band);

  float leftDark = 1.0 - (0.6 * (1.0 - smoothstep(0.0, 0.6, p.x)));
  float bottomDark = 1.0 - (0.75 * smoothstep(0.5, 1.0, p.y));
  float lum = dot(col, vec3(0.3, 0.59, 0.11));
  col = ((mix(vec3(lum), col, 0.78) * 0.5) * leftDark) * bottomDark;

  vec2 dg = vec2((p.x - uGlowPos.x) * aspect, (p.y - uGlowPos.y) * 1.3);
  col = col + ((uGlow.xyz * exp((-(dot(dg, dg))) * 10.0)) * 0.55);

  float d = distance(p, vec2(0.5, 0.5)) * 1.2;
  col = col * (1.0 - (smoothstep(0.5, 1.2, d) * 0.6));
  fragColor = vec4(max(col, vec3(0.0)), 1.0);
}
