import { expect, test } from 'vitest';
import { APPS, rgb01 } from '../config/content';
import { glowUV } from '../core/layout';
import { createState, type SceneState } from '../core/state';
import { backgroundParams, backgroundSize } from './background';

test('background target is a quarter of the drawing buffer, at least one pixel', () => {
  expect(backgroundSize(1280, 720)).toEqual({ width: 320, height: 180 });
  expect(backgroundSize(1283, 723)).toEqual({ width: 320, height: 180 });
  expect(backgroundSize(3, 2)).toEqual({ width: 1, height: 1 });
});

test('settled state shows the target print with the wipe finished', () => {
  const s = createState();
  const p = backgroundParams(s, APPS);
  expect(p).toMatchObject({ from: 0, to: 0, t: 1, dir: 1, seed: 0.37, time: 0 });
  expect(p.glow).toEqual(rgb01(APPS[0]!.glow));
  expect(p.glowPos).toEqual(glowUV(s));
});

test('a running wipe passes its progress, direction and seed', () => {
  const s: SceneState = {
    ...createState(),
    time: 3.5,
    bgFrom: 4,
    bgTo: 2,
    bgT: 0.3,
    bgRunning: true,
    bgDir: -1,
    bgSeed: 0.81,
  };
  expect(backgroundParams(s, APPS)).toMatchObject({
    from: 4,
    to: 2,
    t: 0.3,
    dir: -1,
    seed: 0.81,
    time: 3.5,
  });
  expect(backgroundParams({ ...s, bgRunning: false }, APPS).t).toBe(1);
});

test('glow color follows the discrete selection and dims on the inputs row', () => {
  const s = { ...createState(), selected: 2, selectedF: 1.4, scroll: 0, scrollF: 0.2 };
  const onApps = backgroundParams(s, APPS);
  expect(onApps.glow).toEqual(rgb01(APPS[2]!.glow));
  expect(onApps.glowPos).toEqual(glowUV(s));

  const onInputs = backgroundParams({ ...s, row: 1 }, APPS);
  const [r, g, b] = rgb01(APPS[2]!.glow);
  expect(onInputs.glow[0]).toBeCloseTo(r * 0.35, 10);
  expect(onInputs.glow[1]).toBeCloseTo(g * 0.35, 10);
  expect(onInputs.glow[2]).toBeCloseTo(b * 0.35, 10);
});
