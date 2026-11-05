import { expect, test } from 'vitest';
import { createState } from './state';
import { selectApp } from './navigation';
import { advance } from './advance';

const run = (s: ReturnType<typeof createState>, seconds: number, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) advance(s, dt, () => 0.5);
};

test('exponential easing uses rate 9 for selection and 7 for scroll', () => {
  const s = createState();
  s.selected = 1;
  s.scroll = 1;
  s.inputSel = 1;
  advance(s, 1 / 60, () => 0.5);
  expect(s.selectedF).toBeCloseTo(0.139292, 6);
  expect(s.inputSelF).toBeCloseTo(0.139292, 6);
  expect(s.scrollF).toBeCloseTo(0.110118, 6);
  expect(s.time).toBeCloseTo(1 / 60, 9);
});

test('a long frame is clamped to 0.05 s (Review Focus 2)', () => {
  const s = createState();
  s.selected = 1;
  s.scroll = 1;
  advance(s, 5, () => 0.5);
  expect(s.time).toBeCloseTo(0.05, 9);
  expect(s.selectedF).toBeCloseTo(0.362372, 6);
  expect(s.scrollF).toBeCloseTo(0.295312, 6);
});

test('sweep advances at 2.4 per second and stops at 2.2', () => {
  const s = createState();
  advance(s, 0.05, () => 0.5);
  expect(s.sweep).toBeCloseTo(0.12, 9);
  run(s, 2);
  expect(s.sweep).toBe(2.2);
});

test('background transition starts from the queue and lasts 1.1 s', () => {
  const s = createState();
  selectApp(s, 3, 10);
  advance(s, 1 / 60, () => 0.25);
  expect([s.bgRunning, s.bgFrom, s.bgTo, s.bgDir, s.bgSeed, s.bgT]).toEqual([
    true,
    0,
    3,
    1,
    0.25,
    0,
  ]);
  expect(s.bgQueue).toEqual([]);
  run(s, 1.0);
  expect(s.bgRunning).toBe(true);
  run(s, 0.2);
  expect([s.bgRunning, s.bgShown, s.bgFrom, s.bgTo, s.bgT]).toEqual([false, 3, 3, 3, 1]);
});

test('direction is -1 when moving to a lower index', () => {
  const s = createState();
  s.selected = 5;
  s.bgShown = 5;
  s.bgFrom = 5;
  s.bgTo = 5;
  selectApp(s, 2, 10);
  advance(s, 1 / 60, () => 0.5);
  expect(s.bgDir).toBe(-1);
});

test('an entry equal to what is shown is dropped without a transition', () => {
  const s = createState();
  s.bgQueue.push(0);
  advance(s, 1 / 60, () => 0.5);
  expect([s.bgRunning, s.bgQueue.length]).toEqual([false, 0]);
});

test('held key: queue drains in order and ends on the final selection (Review Focus 1)', () => {
  const s = createState();
  const seen: number[] = [];
  for (let i = 1; i <= 9; i++) selectApp(s, i, 10);
  expect(s.bgQueue).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let f = 0; f < 60 * 12; f++) {
    advance(s, 1 / 60, () => 0.5);
    if (s.bgRunning && seen[seen.length - 1] !== s.bgTo) seen.push(s.bgTo);
  }
  expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect([s.bgRunning, s.bgShown, s.bgQueue.length]).toEqual([false, 9, 0]);
  expect(s.selectedF).toBeCloseTo(9, 3);
  expect(s.scrollF).toBeCloseTo(5, 3);
});
