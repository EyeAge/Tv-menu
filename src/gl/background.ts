import * as THREE from 'three';
import { rgb01, type AppEntry } from '../config/content';
import { SCENE } from '../config/scene';
import { glowUV } from '../core/layout';
import type { SceneState } from '../core/state';
import backgroundFrag from './shaders/background.frag.glsl?raw';
import { FullscreenPass } from './webgl';

/** Background target size for a drawing buffer: a quarter in each direction, at least 1 pixel. */
export function backgroundSize(
  bufferW: number,
  bufferH: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.floor(bufferW / SCENE.bgDownscale)),
    height: Math.max(1, Math.floor(bufferH / SCENE.bgDownscale)),
  };
}

/** What the background shader reads from the scene state, as the original fills its uniforms. */
export interface BackgroundParams {
  /** Print index the wipe starts from. */
  from: number;
  /** Print index the wipe ends on; the settled image. */
  to: number;
  time: number;
  /** Wipe progress, 1 when no wipe is running. */
  t: number;
  dir: number;
  seed: number;
  /** Glow center in the original uv (origin top-left), from the eased selection. */
  glowPos: { x: number; y: number };
  /** Glow color of the selected app, dimmed on the inputs row. */
  glow: [number, number, number];
}

export function backgroundParams(s: SceneState, apps: readonly AppEntry[]): BackgroundParams {
  const dim = s.row === 0 ? 1 : SCENE.rowDimGlow;
  const [r, g, b] = rgb01(apps[s.selected]!.glow);
  return {
    from: s.bgFrom,
    to: s.bgTo,
    time: s.time,
    t: s.bgRunning ? s.bgT : 1,
    dir: s.bgDir,
    seed: s.bgSeed,
    glowPos: glowUV(s),
    glow: [r * dim, g * dim, b * dim],
  };
}

/**
 * Draws the full-stage background into a quarter-resolution target: the selected app's print,
 * enlarged, warped, blurred and darkened, with a noisy wipe from the previous print. The target
 * is stored upright like the prints (its top row is the original's y = 0).
 */
export class BackgroundPass {
  readonly texture: THREE.Texture;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly pass: FullscreenPass;
  private readonly uniforms = {
    uTexA: { value: null as THREE.Texture | null },
    uTexB: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uT: { value: 1 },
    uDir: { value: 1 },
    uSeed: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uGlowPos: { value: new THREE.Vector2() },
    uGlow: { value: new THREE.Vector4(0, 0, 0, 1) },
  };

  constructor(
    private readonly prints: THREE.WebGLRenderTarget[],
    private readonly apps: readonly AppEntry[],
  ) {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
    });
    this.texture = this.target.texture;
    this.pass = new FullscreenPass(backgroundFrag, this.uniforms);
  }

  /** Sizes the target to a quarter of the drawing buffer (in buffer pixels). */
  resize(bufferW: number, bufferH: number): void {
    const { width, height } = backgroundSize(bufferW, bufferH);
    this.target.setSize(width, height);
    this.uniforms.uRes.value.set(width, height);
  }

  /** Draws into the internal target; the renderer's previous render target is restored. */
  render(renderer: THREE.WebGLRenderer, s: SceneState): void {
    const p = backgroundParams(s, this.apps);
    const u = this.uniforms;
    u.uTexA.value = this.prints[p.from]!.texture;
    u.uTexB.value = this.prints[p.to]!.texture;
    u.uTime.value = p.time;
    u.uT.value = p.t;
    u.uDir.value = p.dir;
    u.uSeed.value = p.seed;
    u.uGlowPos.value.set(p.glowPos.x, p.glowPos.y);
    u.uGlow.value.set(p.glow[0], p.glow[1], p.glow[2], 1);

    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    this.pass.render(renderer);
    renderer.setRenderTarget(previous);
  }

  dispose(): void {
    this.target.dispose();
    this.pass.dispose();
  }
}
