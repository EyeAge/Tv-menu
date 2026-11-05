import { expect, test } from 'vitest';
import { APPS, INPUTS, rgb01 } from './content';

test('ten apps and five inputs in the original order', () => {
  expect(APPS.map((a) => a.name)).toEqual([
    'Netflix',
    'YouTube',
    'Prime Video',
    'Disney+',
    'Hulu',
    'HBO Max',
    'Apple TV+',
    'Peacock',
    'Plex',
    'Tubi',
  ]);
  expect(INPUTS).toEqual(['SMARTCAST', 'HDMI-1', 'HDMI-2', 'COMP', 'TV']);
});

test('print parameters match the original', () => {
  expect(APPS.map((a) => [a.kind, a.seed, a.scale, a.ink])).toEqual([
    [1, 0.3, 9, 0.9],
    [0, 1.1, 8, 0.8],
    [2, 2.2, 10, 0.7],
    [0, 3.3, 7, 0.6],
    [3, 4.4, 9, 0.8],
    [1, 5.5, 8, 0.7],
    [4, 6.6, 11, 0.9],
    [2, 7.7, 9, 0.85],
    [0, 8.8, 10, 0.9],
    [3, 9.9, 12, 0.6],
  ]);
});

test('colors are 0..255 integers and rgb01 normalizes', () => {
  for (const a of APPS) {
    for (const c of [a.glow, ...a.colors]) {
      for (const v of c) expect(Number.isInteger(v) && v >= 0 && v <= 255).toBe(true);
    }
  }
  expect(APPS[0]!.glow).toEqual([255, 70, 90]);
  expect(APPS[9]!.colors[2]).toEqual([220, 60, 170]);
  expect(rgb01([255, 0, 51])).toEqual([1, 0, 0.2]);
});
