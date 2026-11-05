import { afterEach, describe, expect, it, vi } from 'vitest';
import { createState } from '../core/state';
import { SceneController } from './controller';
import { FrameStats, debugRequested, installDebug, isSettled } from './debug';

describe('isSettled', () => {
  const rested = () => ({ ...createState(), sweep: 2.2 });
  it('is true once the start-up sweep has finished', () => {
    expect(isSettled(rested())).toBe(true);
  });
  it('is false while the card highlight sweeps', () => {
    expect(isSettled(createState())).toBe(false);
    expect(isSettled({ ...rested(), sweep: 2.1 })).toBe(false);
  });
  it('is false while a background transition runs or is queued', () => {
    expect(isSettled({ ...rested(), bgRunning: true })).toBe(false);
    expect(isSettled({ ...rested(), bgQueue: [2] })).toBe(false);
  });
  it('is false while an eased value is away from its target', () => {
    expect(isSettled({ ...rested(), selected: 1, selectedF: 0.5 })).toBe(false);
    expect(isSettled({ ...rested(), scroll: 1 })).toBe(false);
    expect(isSettled({ ...rested(), inputSel: 2, inputSelF: 1.9995 })).toBe(true);
  });
});

describe('debugRequested', () => {
  it('only accepts debug=1', () => {
    expect(debugRequested('?debug=1')).toBe(true);
    expect(debugRequested('')).toBe(false);
    expect(debugRequested('?debug=0')).toBe(false);
  });
});

describe('FrameStats', () => {
  it('reports the average frame interval and render time once per window', () => {
    const stats = new FrameStats(5000);
    // The first frame only sets the reference point.
    expect(stats.record(1000, 1003)).toBeNull();
    // Then a frame every 20 ms whose render call takes 4 ms; the window fills at frame 250.
    for (let i = 1; i < 250; i++) expect(stats.record(1000 + i * 20, 1004 + i * 20)).toBeNull();
    expect(stats.record(6000, 6004)).toBe(
      'avg frame time 20.00 ms, render call 4.00 ms, 250 frames',
    );
    // The next window starts from the last frame.
    for (let i = 1; i < 100; i++) expect(stats.record(6000 + i * 50, 6001 + i * 50)).toBeNull();
    expect(stats.record(11000, 11001)).toBe(
      'avg frame time 50.00 ms, render call 1.00 ms, 100 frames',
    );
  });
});

describe('installDebug', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('patch refreshes the text before it redraws', () => {
    vi.stubGlobal('window', {});
    const c = new SceneController({ random: () => 0.5 });
    const dispose = installDebug(c, '?debug=1');
    const onText = vi.fn();
    c.subscribeText(onText);
    const titlesSeenByFrame: string[] = [];
    c.onFrame(() => titlesSeenByFrame.push(c.getText().title));

    window.__tvmenu!.patch({ selected: 3, selectedF: 3 });

    expect(c.getText().title).toBe('Disney+');
    expect(onText).toHaveBeenCalledTimes(1);
    expect(titlesSeenByFrame).toEqual(['Disney+']);
    dispose();
    expect(window.__tvmenu).toBeUndefined();
  });
});
