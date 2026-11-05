import * as THREE from 'three';
import type { AppEntry } from '../config/content';
import { SCENE } from '../config/scene';
import type { SceneState } from '../core/state';
import { createPrints } from './prints';
import copyFrag from './shaders/copy.frag.glsl?raw';
import { FullscreenPass } from './webgl';

/** card.wgsl samples the print on the card face at uv * 0.62 + 0.2. */
const CARD_FACE_UV_SCALE = 0.62;
const CARD_FACE_UV_OFFSET = 0.2;

/** `?debug=prints` layout, in stage pixels: one card-shaped cell per app, in app order. */
const PRINT_GRID = { cols: 5, cellW: 232, gap: 16 };

function printsDebugRequested(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === 'prints';
}

/** Owns the WebGL context on the stage canvas and draws the scene from the scene state. */
export class SceneRenderer {
  readonly prints: THREE.WebGLRenderTarget[];
  private readonly renderer: THREE.WebGLRenderer;
  private readonly copy: FullscreenPass;
  private readonly copyTex: THREE.IUniform<THREE.Texture | null> = { value: null };
  private readonly showPrints = printsDebugRequested();
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement, apps: readonly AppEntry[]) {
    // Shader output goes to the screen unchanged.
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);
    this.prints = createPrints(this.renderer, apps);
    this.copy = new FullscreenPass(copyFrag, {
      uTex: this.copyTex,
      uUvScale: { value: new THREE.Vector2(CARD_FACE_UV_SCALE, CARD_FACE_UV_SCALE) },
      uUvOffset: { value: new THREE.Vector2(CARD_FACE_UV_OFFSET, CARD_FACE_UV_OFFSET) },
    });
  }

  /**
   * Sizes the drawing buffer to the on-screen stage size times the device pixel ratio
   * (capped at 2). Three's pixel ratio stays 1 and the canvas's CSS size is left alone.
   */
  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    const ratio = Math.min(dpr, 2);
    this.width = Math.max(1, Math.round(cssWidth * ratio));
    this.height = Math.max(1, Math.round(cssHeight * ratio));
    this.renderer.setSize(this.width, this.height, false);
  }

  // The scene passes that read the state arrive in later tasks.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  render(s: SceneState): void {
    const r = this.renderer;
    r.setRenderTarget(null);
    r.setViewport(0, 0, this.width, this.height);
    r.clear();
    if (this.showPrints) this.drawPrintGrid();
  }

  dispose(): void {
    for (const print of this.prints) print.dispose();
    this.copy.dispose();
    this.renderer.dispose();
  }

  /** Each print framed like a card face (5:3, center 62%), left to right, top to bottom. */
  private drawPrintGrid(): void {
    const { cols, cellW, gap } = PRINT_GRID;
    const cellH = (cellW * SCENE.cardHalfH) / SCENE.cardHalfW;
    const rows = Math.ceil(this.prints.length / cols);
    const left = (SCENE.stageW - (cols * cellW + (cols - 1) * gap)) / 2;
    const top = (SCENE.stageH - (rows * cellH + (rows - 1) * gap)) / 2;
    const kx = this.width / SCENE.stageW;
    const ky = this.height / SCENE.stageH;

    this.prints.forEach((print, i) => {
      const x = left + (i % cols) * (cellW + gap);
      const y = top + Math.floor(i / cols) * (cellH + gap);
      // Viewport y is measured from the bottom of the drawing buffer.
      const x0 = Math.round(x * kx);
      const x1 = Math.round((x + cellW) * kx);
      const y0 = Math.round((SCENE.stageH - y - cellH) * ky);
      const y1 = Math.round((SCENE.stageH - y) * ky);
      this.renderer.setViewport(x0, y0, x1 - x0, y1 - y0);
      this.copyTex.value = print.texture;
      this.copy.render(this.renderer);
    });
    this.renderer.setViewport(0, 0, this.width, this.height);
  }
}
