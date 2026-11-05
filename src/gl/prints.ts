import * as THREE from 'three';
import { rgb01, type AppEntry } from '../config/content';
import { SCENE } from '../config/scene';
import printFrag from './shaders/print.frag.glsl?raw';
import { FullscreenPass } from './webgl';

/** Renders each app's print once into its own 640×400 mirror-repeat texture. */
export function createPrints(
  renderer: THREE.WebGLRenderer,
  apps: readonly AppEntry[],
): THREE.WebGLRenderTarget[] {
  const uniforms = {
    uC0: { value: new THREE.Vector3() },
    uC1: { value: new THREE.Vector3() },
    uC2: { value: new THREE.Vector3() },
    uC3: { value: new THREE.Vector3() },
    uPP: { value: new THREE.Vector4() },
    uRes: { value: new THREE.Vector2(SCENE.printW, SCENE.printH) },
  };
  const pass = new FullscreenPass(printFrag, uniforms);
  const previous = renderer.getRenderTarget();

  const prints = apps.map((app) => {
    const target = new THREE.WebGLRenderTarget(SCENE.printW, SCENE.printH, {
      wrapS: THREE.MirroredRepeatWrapping,
      wrapT: THREE.MirroredRepeatWrapping,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
    });
    const [c0, c1, c2, c3] = app.colors;
    uniforms.uC0.value.fromArray(rgb01(c0));
    uniforms.uC1.value.fromArray(rgb01(c1));
    uniforms.uC2.value.fromArray(rgb01(c2));
    uniforms.uC3.value.fromArray(rgb01(c3));
    uniforms.uPP.value.set(app.kind, app.seed, app.scale, app.ink);
    renderer.setRenderTarget(target);
    pass.render(renderer);
    return target;
  });

  renderer.setRenderTarget(previous);
  pass.dispose();
  return prints;
}
