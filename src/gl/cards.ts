import * as THREE from 'three';
import { rgb01, type AppEntry } from '../config/content';
import { SCENE } from '../config/scene';
import { cardX, focus } from '../core/layout';
import type { SceneState } from '../core/state';
import cardFrag from './shaders/card.frag.glsl?raw';
import cardVert from './shaders/card.vert.glsl?raw';
import commonGlsl from './shaders/common.glsl?raw';
import { setPremultipliedBlending } from './webgl';

/** The original's card camera: 30° vertical fov over the stage's aspect, eye at (0, 0, 6). */
export function createCardCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    THREE.MathUtils.radToDeg(SCENE.fovY),
    SCENE.stageW / SCENE.stageH,
    SCENE.near,
    SCENE.far,
  );
  camera.position.set(0, 0, SCENE.cameraZ);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

/** proj · view for a camera whose world matrix is up to date. */
export function cardViewProjection(camera: THREE.Camera): THREE.Matrix4 {
  return new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
}

/** The original skips any card whose center is at |x| >= 3.4 world units. */
export function cardVisible(x: number): boolean {
  return Math.abs(x) < SCENE.cullX;
}

/**
 * Indices of the cards to draw, back to front: sorted by distance to the eased selection,
 * farthest first, so the selected card is drawn last. Culled cards are left out.
 */
export function cardOrder(s: SceneState, appCount: number): number[] {
  const visible: number[] = [];
  for (let i = 0; i < appCount; i++) if (cardVisible(cardX(i, s.scrollF))) visible.push(i);
  return visible.sort((a, b) => Math.abs(s.selectedF - b) - Math.abs(s.selectedF - a));
}

/** One draw of the card pass: the uniforms card.frag.glsl reads, as the original fills them. */
export interface CardDraw {
  index: number;
  reflection: boolean;
  model: THREE.Matrix4;
  mvp: THREE.Matrix4;
  /** Glow color and the reflection's fade height. */
  glow: [number, number, number, number];
  /** Dimmed focus, reflection flag, sweep position, floor y. */
  params: [number, number, number, number];
}

/**
 * Every draw of the card pass in order: all reflections, then all cards, each pass back to
 * front (see `cardOrder`). `viewProj` is `cardViewProjection` of the card camera.
 */
export function cardDraws(
  s: SceneState,
  apps: readonly AppEntry[],
  viewProj: THREE.Matrix4,
): CardDraw[] {
  const order = cardOrder(s, apps.length);
  const rowDim = s.row === 0 ? 1 : SCENE.rowDimCard;
  const draws: CardDraw[] = [];
  for (const reflection of [true, false]) {
    for (const index of order) {
      const x = cardX(index, s.scrollF);
      const f = focus(index, s.selectedF);
      const scale = SCENE.scaleBase + SCENE.scaleFocus * f;
      const z = SCENE.zFocus * f;
      // T(x, cardY, z) · RotY(-x · rotYPerX) · Scale(s, s, 1)
      let model = new THREE.Matrix4()
        .makeTranslation(x, SCENE.cardY, z)
        .multiply(new THREE.Matrix4().makeRotationY(-x * SCENE.rotYPerX))
        .multiply(new THREE.Matrix4().makeScale(scale, scale, 1));
      const floorY = SCENE.cardY - scale * SCENE.cardHalfH - SCENE.floorGap;
      if (reflection) {
        // T(0, 2 · floorY, 0) · RotX(π) · model
        model = new THREE.Matrix4()
          .makeTranslation(0, 2 * floorY, 0)
          .multiply(new THREE.Matrix4().makeRotationX(Math.PI))
          .multiply(model);
      }
      const [r, g, b] = rgb01(apps[index]!.glow);
      draws.push({
        index,
        reflection,
        model,
        mvp: new THREE.Matrix4().multiplyMatrices(viewProj, model),
        glow: [r, g, b, scale * SCENE.glowHeightK],
        params: [f * rowDim, reflection ? 1 : 0, f > 0.5 ? s.sweep : SCENE.sweepMax, floorY],
      });
    }
  }
  return draws;
}

/** Face (group) order of THREE.BoxGeometry. */
const BOX_FACE = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 } as const;

/**
 * The card box: BoxGeometry(1, 0.6, 0.06) rearranged to match the original's box, which matters
 * because the card pass has no depth test, so faces overwrite each other in index order:
 * - faces in the original's order: front, back, right, left, top, bottom;
 * - top and bottom wound clockwise seen from outside, as in the original. With back faces culled,
 *   they are skipped from outside and drawn from inside. The camera is above every card, so the
 *   bottom face is drawn, last, over the lowest pixels of the front face in its dark side shade;
 * - top and bottom with v flipped, to the original's uv layout.
 */
export function createCardGeometry(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(2 * SCENE.cardHalfW, 2 * SCENE.cardHalfH, 2 * SCENE.cardHalfD);
  const src = Array.from(box.getIndex()!.array);
  const uv = box.getAttribute('uv');
  const faceIndices = (face: number) => {
    const { start, count } = box.groups[face]!;
    return src.slice(start, start + count);
  };
  const flipped: number[] = [BOX_FACE.py, BOX_FACE.ny];
  for (const face of flipped) {
    for (const i of new Set(faceIndices(face))) uv.setY(i, 1 - uv.getY(i));
  }
  const order = [BOX_FACE.pz, BOX_FACE.nz, BOX_FACE.px, BOX_FACE.nx, BOX_FACE.py, BOX_FACE.ny];
  const index: number[] = [];
  for (const face of order) {
    const tris = faceIndices(face);
    for (let t = 0; t < tris.length; t += 3) {
      const [a, b, c] = tris.slice(t, t + 3) as [number, number, number];
      if (flipped.includes(face)) index.push(a, c, b);
      else index.push(a, b, c);
    }
  }
  box.setIndex(index);
  box.clearGroups();
  return box;
}

/**
 * The row of 3D cards and their mirrored reflections, textured with the prints. Draws straight
 * into the renderer's current target with premultiplied-alpha blending, without clearing, and
 * with no depth test: draw order alone decides what is in front.
 */
export class CardsPass {
  private readonly camera = createCardCamera();
  private readonly viewProj = cardViewProjection(this.camera);
  private readonly geometry = createCardGeometry();
  private readonly material: THREE.RawShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly uniforms = {
    uMvp: { value: new THREE.Matrix4() },
    uModel: { value: new THREE.Matrix4() },
    uGlow: { value: new THREE.Vector4() },
    uParams: { value: new THREE.Vector4() },
    uTex: { value: null as THREE.Texture | null },
  };

  constructor(
    private readonly prints: THREE.WebGLRenderTarget[],
    private readonly apps: readonly AppEntry[],
  ) {
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: cardVert,
      fragmentShader: `${commonGlsl}\n${cardFrag}`,
      uniforms: this.uniforms,
      side: THREE.FrontSide, // cull back faces
      depthTest: false,
      depthWrite: false,
    });
    setPremultipliedBlending(this.material);
    // The mesh keeps an identity world matrix; uMvp and uModel carry each draw's transform.
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  /** Draws into the current target without clearing it. One render call per draw, in order. */
  render(renderer: THREE.WebGLRenderer, s: SceneState): void {
    const u = this.uniforms;
    for (const d of cardDraws(s, this.apps, this.viewProj)) {
      u.uMvp.value.copy(d.mvp);
      u.uModel.value.copy(d.model);
      u.uGlow.value.fromArray(d.glow);
      u.uParams.value.fromArray(d.params);
      u.uTex.value = this.prints[d.index]!.texture;
      renderer.render(this.scene, this.camera);
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
