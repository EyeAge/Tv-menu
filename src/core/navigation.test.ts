// src/core/navigation.test.ts
import { describe, expect, test } from 'vitest';
import { createState } from './state';
import { handleKey, hover, pointerDown, selectApp } from './navigation';

const N = 10;
const M = 5;

test('initial state', () => {
  expect(createState()).toEqual({
    row: 0,
    selected: 0,
    selectedF: 0,
    scroll: 0,
    scrollF: 0,
    inputSel: 0,
    inputSelF: 0,
    sweep: 0,
    time: 0,
    bgShown: 0,
    bgFrom: 0,
    bgTo: 0,
    bgT: 1,
    bgRunning: false,
    bgDir: 1,
    bgSeed: 0.37,
    bgQueue: [],
  });
});

describe('selectApp', () => {
  test('clamps at both ends and is a no-op when unchanged', () => {
    const s = createState();
    expect(selectApp(s, -1, N)).toBe(false);
    expect(s.selected).toBe(0);
    expect(s.bgQueue).toEqual([]);
    expect(selectApp(s, 99, N)).toBe(true);
    expect(s.selected).toBe(9);
    expect(selectApp(s, 10, N)).toBe(false);
  });

  test('resets sweep and queues the background', () => {
    const s = createState();
    s.sweep = 2.2;
    selectApp(s, 3, N);
    expect(s.sweep).toBe(0);
    expect(s.bgQueue).toEqual([3]);
  });

  test('scroll window moves the minimum distance', () => {
    const s = createState();
    const scrolls: number[] = [];
    for (let i = 1; i <= 9; i++) {
      selectApp(s, i, N);
      scrolls.push(s.scroll);
    }
    expect(scrolls).toEqual([0, 0, 0, 0, 1, 2, 3, 4, 5]);
    const back: number[] = [];
    for (let i = 8; i >= 0; i--) {
      selectApp(s, i, N);
      back.push(s.scroll);
    }
    expect(back).toEqual([5, 5, 5, 5, 4, 3, 2, 1, 0]);
  });
});

describe('handleKey on the apps row', () => {
  test('left and right move, down enters inputs, enter replays the sweep', () => {
    const s = createState();
    expect(handleKey(s, 'right', N, M)).toBe(true);
    expect(s.selected).toBe(1);
    expect(handleKey(s, 'left', N, M)).toBe(true);
    expect(s.selected).toBe(0);
    s.sweep = 2.2;
    expect(handleKey(s, 'enter', N, M)).toBe(true);
    expect(s.sweep).toBe(0);
    expect(s.bgQueue).toEqual([1, 0]);
    expect(handleKey(s, 'down', N, M)).toBe(true);
    expect(s.row).toBe(1);
  });

  test('up, escape and backspace are not handled', () => {
    const s = createState();
    for (const k of ['up', 'escape', 'backspace'] as const)
      expect(handleKey(s, k, N, M)).toBe(false);
    expect(s.row).toBe(0);
  });
});

describe('handleKey on the inputs row', () => {
  test('left and right clamp; up, escape, backspace return to apps', () => {
    const s = createState();
    s.row = 1;
    handleKey(s, 'left', N, M);
    expect(s.inputSel).toBe(0);
    for (let i = 0; i < 9; i++) handleKey(s, 'right', N, M);
    expect(s.inputSel).toBe(4);
    for (const k of ['up', 'escape', 'backspace'] as const) {
      s.row = 1;
      expect(handleKey(s, k, N, M)).toBe(true);
      expect(s.row).toBe(0);
    }
    expect(s.inputSel).toBe(4);
  });

  test('down and enter are not handled and change nothing', () => {
    const s = createState();
    s.row = 1;
    s.sweep = 2.2;
    expect(handleKey(s, 'down', N, M)).toBe(false);
    expect(handleKey(s, 'enter', N, M)).toBe(false);
    expect(s.row).toBe(1);
    expect(s.sweep).toBe(2.2);
    expect(s.selected).toBe(0);
  });
});

describe('pointer', () => {
  test('hover selects across rows and ignores misses', () => {
    const s = createState();
    expect(hover(s, { row: -1, index: 0 }, N)).toBe(false);
    expect(hover(s, { row: 0, index: 0 }, N)).toBe(false);
    expect(hover(s, { row: 1, index: 2 }, N)).toBe(true);
    expect([s.row, s.inputSel]).toEqual([1, 2]);
    expect(hover(s, { row: 0, index: 0 }, N)).toBe(true);
    expect([s.row, s.selected]).toEqual([0, 0]);
    expect(hover(s, { row: 0, index: 4 }, N)).toBe(true);
    expect(s.selected).toBe(4);
  });

  test('clicking the selected card replays the sweep; other clicks behave like hover', () => {
    const s = createState();
    s.sweep = 2.2;
    expect(pointerDown(s, { row: 0, index: 0 }, N)).toBe(true);
    expect(s.sweep).toBe(0);
    expect(s.bgQueue).toEqual([]);
    pointerDown(s, { row: 0, index: 2 }, N);
    expect(s.selected).toBe(2);
    pointerDown(s, { row: 1, index: 3 }, N);
    expect([s.row, s.inputSel]).toEqual([1, 3]);
    s.sweep = 2.2;
    pointerDown(s, { row: 0, index: 2 }, N);
    expect([s.row, s.sweep]).toEqual([0, 2.2]);
    expect(pointerDown(s, { row: -1, index: 0 }, N)).toBe(false);
  });
});
