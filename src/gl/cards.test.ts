import * as THREE from 'three';
import { expect, test } from 'vitest';
import { APPS, rgb01 } from '../config/content';
import { cardRect } from '../core/layout';
import { createState, type SceneState } from '../core/state';
import {
  cardDraws,
  cardOrder,
  cardViewProjection,
  cardVisible,
  createCardCamera,
  createCardGeometry,
  type CardDraw,
} from './cards';

// Expected values below are worked out by hand from the scene spec's card pass:
//   x = (i - scrollF)*1.07 - 1.98, f = max(0, 1 - |selectedF - i|), s = 0.86 + 0.16*f,
//   z = 0.25*f, model = T(x, -0.49, z) * RotY(-x*0.11) * Scale(s, s, 1),
//   floorY = -0.49 - s*0.3 - 0.02, reflection = T(0, 2*floorY, 0) * RotX(pi) * model,
//   glow = (glow rgb, s*0.6), params = (f*rowDim, refl, f > 0.5 ? sweep : 2.2, floorY).

const viewProj = cardViewProjection(createCardCamera());

/** Compares the top three rows of a matrix (the bottom row is always 0 0 0 1 here). */
function expectRows(m: THREE.Matrix4, rows: number[][]): void {
  const e = m.elements; // column-major
  rows.forEach((row, r) => row.forEach((v, c) => expect(e[c * 4 + r]).toBeCloseTo(v, 10)));
  expectClose([e[3]!, e[7]!, e[11]!, e[15]!], [0, 0, 0, 1]);
}

/** Card model rows for world x, focus scale s and depth z. */
function cardRows(x: number, s: number, z: number): number[][] {
  const a = -x * 0.11;
  const c = Math.cos(a);
  const n = Math.sin(a);
  return [
    [c * s, 0, n, x],
    [0, s, 0, -0.49],
    [-n * s, 0, c, z],
  ];
}

function expectClose(actual: readonly number[], expected: readonly number[], digits = 10): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((v, k) => expect(actual[k]).toBeCloseTo(v, digits));
}

function find(draws: CardDraw[], index: number, reflection: boolean): CardDraw {
  const d = draws.find((x) => x.index === index && x.reflection === reflection);
  if (!d) throw new Error(`no draw for card ${index} (reflection ${reflection})`);
  return d;
}

/** Stage pixels (1280×720, origin top-left) of a local point drawn with `mvp`. */
function toStage(mvp: THREE.Matrix4, x: number, y: number, z: number): { x: number; y: number } {
  const v = new THREE.Vector4(x, y, z, 1).applyMatrix4(mvp);
  return { x: (v.x / v.w + 1) * 640, y: (1 - v.y / v.w) * 360 };
}

const scrolled = (): SceneState => ({
  ...createState(),
  selected: 9,
  selectedF: 9,
  scroll: 5,
  scrollF: 5,
});

test('cards at |x| >= 3.4 are culled', () => {
  expect(cardVisible(0)).toBe(true);
  expect(cardVisible(3.399)).toBe(true);
  expect(cardVisible(-3.399)).toBe(true);
  expect(cardVisible(3.4)).toBe(false);
  expect(cardVisible(-3.4)).toBe(false);
  expect(cardVisible(4.44)).toBe(false);
});

test('initial state: cards 0-5 drawn farthest first, all reflections before all cards', () => {
  const s = createState();
  // x: -1.98, -0.91, 0.16, 1.23, 2.30, 3.37 for cards 0-5; card 6 is at 4.44 and culled.
  expect(cardOrder(s, APPS.length)).toEqual([5, 4, 3, 2, 1, 0]);
  const draws = cardDraws(s, APPS, viewProj);
  expect(draws.map((d) => [d.index, d.reflection])).toEqual([
    [5, true],
    [4, true],
    [3, true],
    [2, true],
    [1, true],
    [0, true],
    [5, false],
    [4, false],
    [3, false],
    [2, false],
    [1, false],
    [0, false],
  ]);
});

test('initial state: the selected card is enlarged, brought forward and lit', () => {
  const s = createState();
  const d = find(cardDraws(s, APPS, viewProj), 0, false);
  // f = 1: s = 1.02, z = 0.25, floorY = -0.49 - 0.306 - 0.02 = -0.816.
  expectRows(d.model, cardRows(-1.98, 1.02, 0.25));
  expectClose(d.glow, [...rgb01(APPS[0]!.glow), 0.612]);
  expectClose(d.params, [1, 0, 0, -0.816]);
});

test('initial state: an unselected card at the right edge', () => {
  const s = { ...createState(), sweep: 0.7 };
  const d = find(cardDraws(s, APPS, viewProj), 5, false);
  // f = 0: s = 0.86, z = 0, floorY = -0.49 - 0.258 - 0.02 = -0.768; no sweep (2.2).
  expectRows(d.model, cardRows(3.37, 0.86, 0));
  expectClose(d.glow, [...rgb01(APPS[5]!.glow), 0.516]);
  expectClose(d.params, [0, 0, 2.2, -0.768]);
});

test('a reflection is the card turned about x and moved below the floor line', () => {
  const s = { ...createState(), sweep: 0.7 };
  const draws = cardDraws(s, APPS, viewProj);
  const card = find(draws, 0, false);
  const refl = find(draws, 0, true);
  // RotX(pi) negates rows 1 and 2; T(0, 2*floorY, 0) adds 2*(-0.816) to the y translation.
  const [r0, r1, r2] = cardRows(-1.98, 1.02, 0.25) as [number[], number[], number[]];
  expectRows(refl.model, [r0, [...r1.slice(0, 3).map((v) => -v), 0.49 - 1.632], r2.map((v) => -v)]);
  expectClose(refl.params, [1, 1, 0.7, -0.816]);
  expectClose(refl.glow, card.glow);
});

test('scrolled to the last app: the previous card shows at the left edge', () => {
  const s = { ...scrolled(), sweep: 1.5 };
  // x: card 3 -4.12 (culled), card 4 -3.05, ..., card 9 2.30.
  expect(cardOrder(s, APPS.length)).toEqual([4, 5, 6, 7, 8, 9]);
  const draws = cardDraws(s, APPS, viewProj);
  expect(draws).toHaveLength(12);

  const selected = find(draws, 9, false);
  expectRows(selected.model, cardRows(2.3, 1.02, 0.25));
  expectClose(selected.glow, [...rgb01(APPS[9]!.glow), 0.612]);
  expectClose(selected.params, [1, 0, 1.5, -0.816]);

  const edge = find(draws, 4, false);
  expectRows(edge.model, cardRows(-3.05, 0.86, 0));
  expectClose(edge.params, [0, 0, 2.2, -0.768]);
});

test('on the inputs row the focus term is dimmed to 45%, the geometry is unchanged', () => {
  const apps = { ...createState(), selected: 2, selectedF: 2.3, scrollF: 0 };
  const inputs: SceneState = { ...apps, row: 1 };
  const onApps = cardDraws(apps, APPS, viewProj);
  const onInputs = cardDraws(inputs, APPS, viewProj);
  // Card 2 has f = 0.7, card 3 has f = 0.3.
  expect(find(onInputs, 2, false).params[0]).toBeCloseTo(0.7 * 0.45, 10);
  expect(find(onInputs, 3, false).params[0]).toBeCloseTo(0.3 * 0.45, 10);
  expect(find(onInputs, 2, true).params[0]).toBeCloseTo(0.7 * 0.45, 10);
  expect(find(onApps, 2, false).params[0]).toBeCloseTo(0.7, 10);
  onInputs.forEach((d, k) => {
    expect(d.model.elements).toEqual(onApps[k]!.model.elements);
    expect(d.glow).toEqual(onApps[k]!.glow);
  });
});

test('draw order follows the distance to the eased selection; only f > 0.5 gets the sweep', () => {
  const s = { ...createState(), selected: 2, selectedF: 2.3, sweep: 0.7 };
  // |2.3 - i| for i = 0..5: 2.3, 1.3, 0.3, 0.7, 1.7, 2.7.
  expect(cardOrder(s, APPS.length)).toEqual([5, 0, 4, 1, 3, 2]);
  const draws = cardDraws(s, APPS, viewProj);
  expect(draws.map((d) => d.index)).toEqual([5, 0, 4, 1, 3, 2, 5, 0, 4, 1, 3, 2]);
  expect(find(draws, 2, false).params[2]).toBe(0.7);
  expect(find(draws, 3, false).params[2]).toBe(2.2);

  const half = cardDraws({ ...s, selectedF: 2.5 }, APPS, viewProj);
  expect(find(half, 2, false).params[2]).toBe(2.2);
  expect(find(half, 3, false).params[2]).toBe(2.2);
});

test('the camera shows the z = 0 plane at PPU stage pixels per world unit', () => {
  // PPU = 360 / 1.607695 = 223.9231; the stage center is (640, 360).
  const p = toStage(viewProj, 1, 0.5, 0);
  expect(p.x).toBeCloseTo(640 + 223.9231, 3);
  expect(p.y).toBeCloseTo(360 - 0.5 * 223.9231, 3);
});

test('mvp is view-projection times model and puts card centers on the hit rectangles', () => {
  for (const s of [createState(), scrolled(), { ...createState(), selectedF: 2.3 }]) {
    for (const d of cardDraws(s, APPS, viewProj)) {
      const expected = new THREE.Matrix4().multiplyMatrices(viewProj, d.model);
      expectClose(d.mvp.elements, expected.elements);
      if (d.reflection) continue;
      const c = toStage(d.mvp, 0, 0, 0);
      const r = cardRect(s, d.index);
      expect(c.x).toBeCloseTo(r.cx, 3);
      expect(c.y).toBeCloseTo(r.cy, 3);
    }
  }
});

test('the card box has the original box layout: face order, winding and uv', () => {
  // From the original's boxGeometry: per face (normal, u axis, v axis) with half sizes
  // (0.5, 0.3, 0.03); uv (0,0) sits at center - u - v and uv (1,1) at center + u + v; triangles
  // (0, 2, 1), (0, 3, 2) over corners (-1,-1) (1,-1) (1,1) (-1,1). That makes the top and bottom
  // faces clockwise seen from outside, the other four counterclockwise.
  const faces = [
    { n: [0, 0, 1], uv00: [-0.5, 0.3, 0.03], uv11: [0.5, -0.3, 0.03], ccw: true },
    { n: [0, 0, -1], uv00: [0.5, 0.3, -0.03], uv11: [-0.5, -0.3, -0.03], ccw: true },
    { n: [1, 0, 0], uv00: [0.5, 0.3, 0.03], uv11: [0.5, -0.3, -0.03], ccw: true },
    { n: [-1, 0, 0], uv00: [-0.5, 0.3, -0.03], uv11: [-0.5, -0.3, 0.03], ccw: true },
    { n: [0, 1, 0], uv00: [-0.5, 0.3, 0.03], uv11: [0.5, 0.3, -0.03], ccw: false },
    { n: [0, -1, 0], uv00: [-0.5, -0.3, -0.03], uv11: [0.5, -0.3, 0.03], ccw: false },
  ];
  const g = createCardGeometry();
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const index = Array.from(g.getIndex()!.array);
  expect(index).toHaveLength(36);
  expect(g.groups).toEqual([]);
  const p = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, i);

  faces.forEach((face, k) => {
    const verts = index.slice(k * 6, k * 6 + 6);
    const n = new THREE.Vector3(...face.n);
    for (const i of verts)
      expectClose(new THREE.Vector3().fromBufferAttribute(nrm, i).toArray(), face.n);
    // The shader reads uv as (u, 1 - v); find the corners at original uv (0,0) and (1,1).
    const at = (u: number, v: number) =>
      verts.find((i) => uv.getX(i) === u && 1 - uv.getY(i) === v);
    // Positions are stored as 32-bit floats.
    expectClose(p(at(0, 0)!).toArray(), face.uv00, 6);
    expectClose(p(at(1, 1)!).toArray(), face.uv11, 6);
    for (let t = 0; t < 6; t += 3) {
      const [a, b, c] = [p(verts[t]!), p(verts[t + 1]!), p(verts[t + 2]!)];
      const facing = b.clone().sub(a).cross(c.clone().sub(a)).dot(n);
      expect(facing > 0).toBe(face.ccw);
    }
  });
});
