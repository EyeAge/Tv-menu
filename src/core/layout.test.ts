import { expect, test } from 'vitest';
import { createState } from './state';
import {
  PPU,
  cardRect,
  clientToStage,
  fitStage,
  glowUV,
  hitTest,
  labelSlots,
  pillX,
} from './layout';

const close = (r: object, e: Record<string, number>) => {
  for (const [k, v] of Object.entries(e))
    expect((r as Record<string, number>)[k]).toBeCloseTo(v, 2);
};

test('pixels per world unit', () => {
  expect(PPU).toBeCloseTo(223.9231, 3);
});

test('card rectangles at the initial state', () => {
  const s = createState();
  close(cardRect(s, 0), { cx: 177.355, cy: 474.493, halfW: 119.166, halfH: 71.5 });
  close(cardRect(s, 1), { cx: 436.23, cy: 469.722, halfW: 96.287, halfH: 57.772 });
  close(cardRect(s, 4), { cx: 1155.023, cy: 469.722, halfW: 96.287, halfH: 57.772 });
  close(cardRect(s, 5), { cx: 1394.621, cy: 469.722, halfW: 96.287, halfH: 57.772 });
});

test('card rectangles follow selection and scroll', () => {
  const s = createState();
  s.selected = 9;
  s.selectedF = 9;
  s.scroll = 5;
  s.scrollF = 5;
  close(cardRect(s, 9), { cx: 1177.415, cy: 474.493, halfW: 119.166, halfH: 71.5 });
  close(cardRect(s, 5), { cx: 196.632, cy: 469.722, halfW: 96.287, halfH: 57.772 });
});

test('hit testing cards, inputs and empty space', () => {
  const s = createState();
  expect(hitTest(s, 177, 474, 10, 5)).toEqual({ row: 0, index: 0 });
  expect(hitTest(s, 436, 470, 10, 5)).toEqual({ row: 0, index: 1 });
  expect(hitTest(s, 300, 470, 10, 5)).toEqual({ row: -1, index: 0 });
  expect(hitTest(s, 60, 606, 10, 5)).toEqual({ row: 1, index: 0 });
  expect(hitTest(s, 210, 656, 10, 5)).toEqual({ row: 1, index: 0 });
  expect(hitTest(s, 215, 630, 10, 5)).toEqual({ row: -1, index: 0 });
  expect(hitTest(s, 700, 630, 10, 5)).toEqual({ row: 1, index: 4 });
  expect(hitTest(s, 900, 630, 10, 5)).toEqual({ row: -1, index: 0 });
  expect(hitTest(s, 100, 605, 10, 5)).toEqual({ row: -1, index: 0 });
});

test('six label slots at the initial state', () => {
  const slots = labelSlots(createState(), 10);
  expect(slots.map((l) => l.index)).toEqual([-1, 0, 1, 2, 3, 4]);
  expect(slots[0]!.alpha).toBe(0);
  expect(slots[1]!.x).toBeCloseTo(196.632, 2);
  expect(slots[1]!.alpha).toBeCloseTo(1, 6);
  expect(slots[2]!.x).toBeCloseTo(436.23, 2);
  expect(slots[2]!.alpha).toBeCloseTo(0.35, 6);
  expect(slots[5]!.x).toBeCloseTo(1155.023, 2);
});

test('labels dim by half on the inputs row and fade near the stage edges', () => {
  const s = createState();
  s.row = 1;
  expect(labelSlots(s, 10)[1]!.alpha).toBeCloseTo(0.5, 6);
  s.row = 0;
  s.scrollF = 0.4;
  const first = labelSlots(s, 10)[1]!;
  expect(first.index).toBe(0);
  expect(first.alpha).toBeCloseTo((0.35 + 0.65) * (1 - (2.408 - 2.3) / 0.5), 3);
});

test('pill and glow positions', () => {
  const s = createState();
  expect(pillX(s)).toBe(136);
  s.inputSelF = 4;
  expect(pillX(s)).toBe(776);
  const g = glowUV(createState());
  expect(g.x).toBeCloseTo(0.15362, 4);
  expect(g.y).toBeCloseTo(0.80789, 4);
});

test('stage fit letterboxes and survives degenerate viewports (Review Focus 3)', () => {
  expect(fitStage(1440, 900)).toEqual({ scale: 1.125, left: 0, top: 45 });
  expect(fitStage(1920, 1080)).toEqual({ scale: 1.5, left: 0, top: 0 });
  const tall = fitStage(390, 844);
  expect(tall.scale).toBeCloseTo(0.3047, 4);
  expect(tall.top).toBeCloseTo(312.31, 1);
  expect(fitStage(4000, 720)).toEqual({ scale: 1, left: 1360, top: 0 });
  for (const [w, h] of [
    [0, 0],
    [0, 500],
    [500, 0],
    [-10, 300],
  ] as const) {
    expect(fitStage(w, h)).toEqual({ scale: 0, left: 0, top: 0 });
  }
});

test('pointer in the letterbox maps outside the stage and hits nothing (Review Focus 4)', () => {
  const fit = fitStage(1440, 900);
  const p = clientToStage(720, 20, fit);
  expect(p.y).toBeLessThan(0);
  expect(hitTest(createState(), p.x, p.y, 10, 5)).toEqual({ row: -1, index: 0 });
  const inside = clientToStage(720, 450, fit);
  expect(inside).toEqual({ x: 640, y: 360 });
  expect(clientToStage(10, 10, { scale: 0, left: 0, top: 0 })).toEqual({ x: -1, y: -1 });
});
