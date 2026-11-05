import { describe, expect, it } from 'vitest';
import { createState } from '../core/state';
import { debugRequested, isSettled } from './debug';

describe('isSettled', () => {
  it('is true for a fresh state', () => {
    expect(isSettled(createState())).toBe(true);
  });
  it('is false while a background transition runs or is queued', () => {
    expect(isSettled({ ...createState(), bgRunning: true })).toBe(false);
    expect(isSettled({ ...createState(), bgQueue: [2] })).toBe(false);
  });
  it('is false while an eased value is away from its target', () => {
    expect(isSettled({ ...createState(), selected: 1, selectedF: 0.5 })).toBe(false);
    expect(isSettled({ ...createState(), scroll: 1 })).toBe(false);
    expect(isSettled({ ...createState(), inputSel: 2, inputSelF: 1.9995 })).toBe(true);
  });
});

describe('debugRequested', () => {
  it('only accepts debug=1', () => {
    expect(debugRequested('?debug=1')).toBe(true);
    expect(debugRequested('')).toBe(false);
    expect(debugRequested('?debug=0')).toBe(false);
  });
});
