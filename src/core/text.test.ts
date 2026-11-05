import { expect, test } from 'vitest';
import { APPS } from '../config/content';
import { createState } from './state';
import { HINT_TEXT, counterText, formatClock, formatDate, printText } from './text';

test('clock is 12-hour without a leading zero (Review Focus 5)', () => {
  expect(formatClock(new Date(2026, 10, 5, 0, 5))).toBe('12:05');
  expect(formatClock(new Date(2026, 10, 5, 9, 9))).toBe('9:09');
  expect(formatClock(new Date(2026, 10, 5, 12, 0))).toBe('12:00');
  expect(formatClock(new Date(2026, 10, 5, 13, 7))).toBe('1:07');
  expect(formatClock(new Date(2026, 10, 5, 22, 30))).toBe('10:30');
});

test('date is upper case English with a two-digit day (Review Focus 5)', () => {
  expect(formatDate(new Date(2026, 10, 5))).toBe('THURSDAY, NOVEMBER 05');
  expect(formatDate(new Date(2026, 11, 25))).toBe('FRIDAY, DECEMBER 25');
});

test('counter, print line and hint keep the original spacing', () => {
  const s = createState();
  expect(counterText(s, 10, 5)).toBe('APPS   1 / 10');
  s.row = 1;
  s.inputSel = 2;
  expect(counterText(s, 10, 5)).toBe('INPUTS   3 / 5');
  expect(printText(APPS[0]!)).toBe('PRINT   VERMILION   ·   CRIMSON');
  expect(HINT_TEXT).toBe('ARROWS MOVE   ·   OK OPENS   ·   BACK GOES UP');
});
