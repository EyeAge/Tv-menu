// Port of fs_main from .reference/shaders/grain.wgsl. Prefixed with common.glsl, whose ph is the
// original's hash. Constants are copied verbatim. The output is premultiplied, for blending with
// src = One, dst = OneMinusSrcAlpha over everything drawn before it.

uniform float uTime;
uniform vec2 uRes; // drawing buffer size in device pixels
uniform float uGrain;

out vec4 fragColor;

void main() {
  float frame = floor((uTime * 24.0));
  // The original's fragment position: device pixels, origin top-left, pixel centers at .5.
  vec2 pos = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float g = (ph((pos + vec2((frame * 13.7), (frame * 7.3)))) - 0.5);
  float lift = (max(g, 0.0) * uGrain);
  float drop = (max(-(g), 0.0) * uGrain);
  fragColor = vec4(vec3(lift), (lift + drop));
}
