import { SCENE } from '../config/scene';
import type { Hit, SceneState } from './state';

/** Stage pixels per world unit at the z = 0 plane. */
export const PPU = SCENE.stageH / 2 / SCENE.halfHeightAtOrigin;

const W = SCENE.stageW;
const H = SCENE.stageH;

/** World x of a card center for a given (fractional) scroll position. */
export function cardX(index: number, scrollF: number): number {
  return (index - scrollF) * SCENE.cardSpacing + SCENE.cardOriginX;
}

/** Focus amount of a card, 1 when selected and falling to 0 one slot away. */
export function focus(index: number, selectedF: number): number {
  return Math.max(0, 1 - Math.abs(selectedF - index));
}

/** Rectangle in stage pixels. */
export interface Rect {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
}

export function cardRect(s: SceneState, index: number): Rect {
  const f = focus(index, s.selectedF);
  const scale = SCENE.scaleBase + SCENE.scaleFocus * f;
  const z = SCENE.zFocus * f;
  const persp = SCENE.cameraZ / (SCENE.cameraZ - z);
  const k = PPU * persp;
  return {
    cx: W / 2 + cardX(index, s.scrollF) * k,
    cy: H / 2 - SCENE.cardY * k,
    halfW: scale * SCENE.cardHalfW * k,
    halfH: scale * SCENE.cardHalfH * k,
  };
}

/**
 * Returns the first card (lowest index) under the point, else an input, else nothing. Points
 * outside the stage rectangle (edges included as inside) hit nothing, so the letterbox bars never
 * select a card that extends past the stage edge.
 */
export function hitTest(
  s: SceneState,
  x: number,
  y: number,
  appCount: number,
  inputCount: number,
): Hit {
  if (!(x >= 0 && x <= W && y >= 0 && y <= H)) return { row: -1, index: 0 };
  for (let i = 0; i < appCount; i++) {
    const r = cardRect(s, i);
    if (Math.abs(x - r.cx) <= r.halfW && Math.abs(y - r.cy) <= r.halfH) {
      return { row: 0, index: i };
    }
  }
  if (y >= SCENE.inputTop && y <= SCENE.inputBottom) {
    for (let i = 0; i < inputCount; i++) {
      const x0 = SCENE.inputX0 + SCENE.inputPitch * i;
      if (x >= x0 && x <= x0 + SCENE.inputW) return { row: 1, index: i };
    }
  }
  return { row: -1, index: 0 };
}

/** One of the card-name label slots; alpha is 0 when index is out of range. */
export interface LabelSlot {
  index: number;
  x: number;
  alpha: number;
}

export function labelSlots(s: SceneState, appCount: number): LabelSlot[] {
  const slots: LabelSlot[] = [];
  for (let slot = 0; slot < SCENE.labelSlots; slot++) {
    const index = Math.floor(s.scrollF + 0.5) - 1 + slot;
    const wx = cardX(index, s.scrollF);
    let alpha = 0;
    if (index >= 0 && index < appCount) {
      const f = focus(index, s.selectedF);
      const edge =
        1 - Math.min(1, Math.max(0, (Math.abs(wx) - SCENE.labelFadeStart) / SCENE.labelFadeWidth));
      alpha =
        (SCENE.labelAlphaBase + SCENE.labelAlphaFocus * f) *
        edge *
        (s.row === 0 ? 1 : SCENE.rowDimLabel);
    }
    slots.push({ index, x: W / 2 + wx * PPU, alpha });
  }
  return slots;
}

/** Stage x of the inputs highlight center. */
export function pillX(s: SceneState): number {
  return SCENE.pillX0 + SCENE.inputPitch * s.inputSelF;
}

/** Background glow center in the original uv space (origin top-left). */
export function glowUV(s: SceneState): { x: number; y: number } {
  const xSel = cardX(s.selectedF, s.scrollF);
  return {
    x: 0.5 + (xSel * PPU) / W,
    y: 0.5 - (SCENE.glowYWorld * PPU) / H,
  };
}

export interface Fit {
  scale: number;
  left: number;
  top: number;
}

/** Contain-fit the stage into the viewport, centered; degenerate viewports give scale 0. */
export function fitStage(viewportW: number, viewportH: number): Fit {
  if (!(viewportW > 0) || !(viewportH > 0)) return { scale: 0, left: 0, top: 0 };
  const scale = Math.min(viewportW / W, viewportH / H);
  return { scale, left: (viewportW - W * scale) / 2, top: (viewportH - H * scale) / 2 };
}

/** Map client coordinates to stage pixels; scale 0 yields (-1, -1). */
export function clientToStage(
  clientX: number,
  clientY: number,
  fit: Fit,
): { x: number; y: number } {
  if (fit.scale === 0) return { x: -1, y: -1 };
  return { x: (clientX - fit.left) / fit.scale, y: (clientY - fit.top) / fit.scale };
}
