import * as THREE from 'three';
import type { AppEntry } from '../config/content';
import { SCENE } from '../config/scene';
import type { SceneState } from '../core/state';
import { BackgroundPass } from './background';
import { CardsPass } from './cards';
import { GrainPass } from './grain';
import { createPrints } from './prints';
import copyFrag from './shaders/copy.frag.glsl?raw';
import { FullscreenPass } from './webgl';

/** card.wgsl samples the print on the card face at uv * 0.62 + 0.2. */
const CARD_FACE_UV_SCALE = 0.62;
const CARD_FACE_UV_OFFSET = 0.2;

/** `?debug=prints` layout, in stage pixels: one card-shaped cell per app, in app order. */
const PRINT_GRID = { cols: 5, cellW: 232, gap: 16 };

/**
 * Size of the drawing buffer, fixed whatever the window size or device pixel ratio. The original
 * draws its canvases at artboard resolution (1280×720 times a scale of 1) and lets the runtime
 * scale them to the window; here the stage layout scales the canvas and the browser upscales it
 * with its default bilinear filtering. `SCENE.renderScale` is the single knob to change this.
 */
export function renderBufferSize(): { width: number; height: number } {
  return {
    width: Math.round(SCENE.stageW * SCENE.renderScale),
    height: Math.round(SCENE.stageH * SCENE.renderScale),
  };
}

function printsDebugRequested(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === 'prints';
}

/** Owns the WebGL context on the stage canvas and draws the scene from the scene state. */
export class SceneRenderer {
  readonly prints: THREE.WebGLRenderTarget[];
  private readonly renderer: THREE.WebGLRenderer;
  private readonly background: BackgroundPass;
  /** Stretches the quarter-resolution background over the whole drawing buffer. */
  private readonly backgroundBlit: FullscreenPass;
  private readonly cards: CardsPass;
  private readonly grain = new GrainPass();
  /** Draws a print framed like a card face, for `?debug=prints`. */
  private readonly copy: FullscreenPass;
  private readonly copyTex: THREE.IUniform<THREE.Texture | null> = { value: null };
  private readonly showPrints = printsDebugRequested();
  private readonly width: number;
  private readonly height: number;

  constructor(canvas: HTMLCanvasElement, apps: readonly AppEntry[]) {
    // Shader output goes to the screen unchanged.
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);
    // Fixed buffer size (see renderBufferSize); the canvas's CSS size comes from the stage layout.
    const size = renderBufferSize();
    this.width = size.width;
    this.height = size.height;
    this.renderer.setSize(this.width, this.height, false);
    this.prints = createPrints(this.renderer, apps);
    this.background = new BackgroundPass(this.prints, apps);
    this.background.resize(this.width, this.height);
    this.backgroundBlit = new FullscreenPass(copyFrag, {
      uTex: { value: this.background.texture },
      uUvScale: { value: new THREE.Vector2(1, 1) },
      uUvOffset: { value: new THREE.Vector2(0, 0) },
    });
    this.cards = new CardsPass(this.prints, apps);
    this.copy = new FullscreenPass(copyFrag, {
      uTex: this.copyTex,
      uUvScale: { value: new THREE.Vector2(CARD_FACE_UV_SCALE, CARD_FACE_UV_SCALE) },
      uUvOffset: { value: new THREE.Vector2(CARD_FACE_UV_OFFSET, CARD_FACE_UV_OFFSET) },
    });
  }

  /** Background, then the cards and their reflections, then grain; or the `?debug=prints` grid. */
  render(s: SceneState): void {
    const r = this.renderer;
    if (this.showPrints) {
      r.setRenderTarget(null);
      r.setViewport(0, 0, this.width, this.height);
      r.clear();
      this.drawPrintGrid();
      return;
    }
    this.background.render(r, s);
    r.setRenderTarget(null);
    r.setViewport(0, 0, this.width, this.height);
    this.backgroundBlit.render(r);
    this.cards.render(r, s);
    this.grain.render(r, s.time, this.width, this.height);
  }

  dispose(): void {
    for (const print of this.prints) print.dispose();
    this.background.dispose();
    this.backgroundBlit.dispose();
    this.cards.dispose();
    this.grain.dispose();
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
