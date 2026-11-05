// One triangle that covers the viewport. vUv is the viewport position in the original's
// convention: origin at the top-left, y down, 0..1 across the viewport.
precision highp float;

in vec3 position;
out vec2 vUv;

void main() {
  vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
