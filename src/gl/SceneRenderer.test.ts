import { expect, test } from 'vitest';
import { backgroundSize } from './background';
import { renderBufferSize } from './SceneRenderer';

test('the drawing buffer is the 1280×720 artboard, whatever the window or pixel ratio', () => {
  expect(renderBufferSize()).toEqual({ width: 1280, height: 720 });
});

test('the background target is a quarter of the drawing buffer: 320×180', () => {
  const { width, height } = renderBufferSize();
  expect(backgroundSize(width, height)).toEqual({ width: 320, height: 180 });
});
