// Draws a texture into the viewport. uUvScale/uUvOffset map vUv to the original's uv
// (origin top-left); the y flip happens at the lookup. Prefixed with common.glsl.

uniform sampler2D uTex;
uniform vec2 uUvScale;
uniform vec2 uUvOffset;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec2 uv = vUv * uUvScale + uUvOffset;
  fragColor = vec4(texture(uTex, vec2(uv.x, 1.0 - uv.y)).rgb, 1.0);
}
