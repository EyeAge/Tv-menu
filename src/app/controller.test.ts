import { expect, test, vi } from 'vitest';
import { SceneController } from './controller';

test('text follows the apps row and the inputs row', () => {
  const c = new SceneController();
  expect(c.getText()).toEqual({
    title: 'Netflix',
    sub: 'Series and films',
    counter: 'APPS   1 / 10',
    print: 'PRINT   VERMILION   ·   CRIMSON',
  });
  c.key('right');
  expect(c.getText().title).toBe('YouTube');
  expect(c.getText().print).toBe('PRINT   ORCHARD   ·   TANGERINE');
  c.key('down');
  expect(c.getText()).toEqual({
    title: 'SMARTCAST',
    sub: 'SMARTCAST',
    counter: 'INPUTS   1 / 5',
    print: 'PRINT   ORCHARD   ·   TANGERINE',
  });
});

test('getText is referentially stable and subscribers fire only on change', () => {
  const c = new SceneController();
  const fn = vi.fn();
  c.subscribeText(fn);
  const a = c.getText();
  c.key('left');
  expect(c.getText()).toBe(a);
  expect(fn).not.toHaveBeenCalled();
  c.key('right');
  expect(fn).toHaveBeenCalledTimes(1);
  expect(c.getText()).not.toBe(a);
});

test('pointer events go through hit testing; frame listeners run on tick', () => {
  const c = new SceneController({ random: () => 0.5 });
  c.pointerMove(436, 470);
  expect(c.state.selected).toBe(1);
  c.pointerMove(700, 630);
  expect([c.state.row, c.state.inputSel]).toEqual([1, 4]);
  c.pointerMove(-50, -50);
  expect([c.state.row, c.state.inputSel]).toEqual([1, 4]);
  const frame = vi.fn();
  const off = c.onFrame(frame);
  c.tick(1 / 60);
  expect(frame).toHaveBeenCalledWith(c.state);
  off();
  c.tick(1 / 60);
  expect(frame).toHaveBeenCalledTimes(1);
});
