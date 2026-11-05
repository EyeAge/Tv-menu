// src/gl/webgl.test.ts
import { expect, test } from 'vitest';
import { supportsWebGL2 } from './webgl';

test('reports support only when a context is returned and never throws', () => {
  expect(supportsWebGL2(() => ({}))).toBe(true);
  expect(supportsWebGL2(() => null)).toBe(false);
  expect(
    supportsWebGL2(() => {
      throw new Error('blocked');
    }),
  ).toBe(false);
});
