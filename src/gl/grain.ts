import * as THREE from 'three';
import { SCENE } from '../config/scene';
import grainFrag from './shaders/grain.frag.glsl?raw';
import { FullscreenPass, setPremultipliedBlending } from './webgl';

/** Film grain over the whole drawing buffer, changing 24 times a second. */
export class GrainPass {
  private readonly uniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uGrain: { value: SCENE.grain },
  };
  private readonly pass = new FullscreenPass(grainFrag, this.uniforms);

  constructor() {
    setPremultipliedBlending(this.pass.material);
  }

  /** Blends over the current target; the buffer size is in device pixels. */
  render(renderer: THREE.WebGLRenderer, time: number, bufferW: number, bufferH: number): void {
    this.uniforms.uTime.value = time;
    this.uniforms.uRes.value.set(bufferW, bufferH);
    this.pass.render(renderer);
  }

  dispose(): void {
    this.pass.dispose();
  }
}
