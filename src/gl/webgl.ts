import * as THREE from 'three';
import commonGlsl from './shaders/common.glsl?raw';
import fullscreenVert from './shaders/fullscreen.vert.glsl?raw';

/** True when `getContext('webgl2')` returns a context; an exception counts as unsupported. */
export function supportsWebGL2(getContext: (id: 'webgl2') => unknown): boolean {
  try {
    return Boolean(getContext('webgl2'));
  } catch {
    return false;
  }
}

/**
 * Blending for shaders that output premultiplied color, as the original's card canvas:
 * src = One, dst = OneMinusSrcAlpha for both color and alpha.
 */
export function setPremultipliedBlending(material: THREE.Material): void {
  material.transparent = true;
  material.blending = THREE.CustomBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.OneFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  material.blendEquationAlpha = THREE.AddEquation;
  material.blendSrcAlpha = THREE.OneFactor;
  material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
}

/** One full-viewport triangle drawn with `fragmentBody`, which is prefixed with common.glsl. */
export class FullscreenPass {
  readonly material: THREE.RawShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly geometry = new THREE.BufferGeometry();

  constructor(fragmentBody: string, uniforms: Record<string, THREE.IUniform>) {
    this.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVert,
      fragmentShader: `${commonGlsl}\n${fragmentBody}`,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  /** Draws into the renderer's current render target and viewport. */
  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
