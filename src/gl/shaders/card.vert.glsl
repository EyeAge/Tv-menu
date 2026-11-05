// Port of vs_main from .reference/shaders/card.wgsl. The box is THREE.BoxGeometry(1, 0.6, 0.06),
// whose uv has v pointing up; it is converted here to the original's convention (origin at the
// top-left of each face, v down) so the fragment shader reads like the WGSL.
precision highp float;
precision highp int;

uniform mat4 uMvp;
uniform mat4 uModel;

in vec3 position;
in vec3 normal;
in vec2 uv;

out vec3 vNrm;
out vec2 vUv;
out vec3 vLocal;
out float vWorldY;

void main() {
  gl_Position = uMvp * vec4(position, 1.0);
  vNrm = normalize((uModel * vec4(normal, 0.0)).xyz);
  vUv = vec2(uv.x, 1.0 - uv.y);
  vLocal = position;
  vWorldY = (uModel * vec4(position, 1.0)).y;
}
