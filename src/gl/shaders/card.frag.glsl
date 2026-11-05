// Port of fs_main from .reference/shaders/card.wgsl. Prefixed with common.glsl (precision only;
// no helper is used). Constants and expression order are copied verbatim; do not simplify.
// The output is premultiplied, for blending with src = One, dst = OneMinusSrcAlpha.

uniform vec4 uGlow; // xyz: the app's glow color; w: reflection fade height (card scale * 0.6)
uniform vec4 uParams; // x: focus (dimmed on the inputs row), y: 1 for the reflection, z: sweep, w: floor y
uniform sampler2D uTex; // the app's print, stored upright (flip v at the lookup)

in vec3 vNrm;
in vec2 vUv; // the original's uv: origin at the top-left of each face
in vec3 vLocal;
in float vWorldY;

out vec4 fragColor;

void main() {
  vec3 col;
  vec2 uv;
  float alpha = 1.0;
  float sel = uParams.x;
  float refl = uParams.y;
  float sweep = uParams.z;
  float floorY = uParams.w;
  vec3 n = normalize(vNrm);
  vec3 L = vec3(-0.39801487, 0.696526, 0.5970223);
  vec3 V = vec3(0.0, 0.0, 1.0);
  float diff = max(dot(n, L), 0.0);
  vec3 H = normalize((L + V));
  float spec = pow(max(dot(n, H), 0.0), 40.0);
  // WGSL select(f, t, cond) yields t when cond holds.
  float faceZ = refl > 0.5 ? -0.03 : 0.03;
  float front = step(0.029, (vLocal.z * sign(faceZ)));
  uv = vUv;
  if (refl > 0.5) {
    uv.x = (1.0 - uv.x);
  }
  vec2 printUv = ((uv * vec2(0.62, 0.62)) + vec2(0.2, 0.2));
  vec3 pr = texture(uTex, vec2(printUv.x, 1.0 - printUv.y)).xyz;
  if (front > 0.5) {
    float edge = min(min(uv.x, (1.0 - uv.x)), min(uv.y, (1.0 - uv.y)));
    float bevel = smoothstep(0.0, 0.035, edge);
    col = mix(vec3(0.05, 0.05, 0.06), pr, bevel);
    float s = ((uv.x * 0.8) + ((1.0 - uv.y) * 0.6));
    // pow with a negative base is undefined in GLSL ES (often NaN); the base is negative on every
    // pixel on one side of the highlight band. abs() yields the square the original computes.
    float gloss = ((exp(-(pow(abs((s - (sweep - 0.4)) * 6.0), 2.0))) * 0.55) + (smoothstep(0.55, 1.1, s) * 0.1));
    col = (col + vec3(gloss));
    col = ((col * (0.75 + (0.35 * diff))) + vec3((spec * 0.15)));
    float rim = ((1.0 - smoothstep(0.0, 0.06, edge)) * sel);
    col = mix(col, uGlow.xyz, (rim * 0.8));
  } else {
    col = ((vec3(0.06, 0.065, 0.075) * (0.5 + diff)) + vec3((spec * 0.25)));
    col = (col + (((uGlow.xyz * sel) * 0.25) * (0.3 + diff)));
  }
  col = (col * (0.9 + (0.25 * sel)));
  if (refl > 0.5) {
    float height = max(uGlow.w, 0.01);
    float below = clamp(((floorY - vWorldY) / height), 0.0, 1.0);
    alpha = (0.32 * pow((1.0 - below), 2.2));
    col = (col * 0.75);
  }
  fragColor = vec4((col * alpha), alpha);
}
