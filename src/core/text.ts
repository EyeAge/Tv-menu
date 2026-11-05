import type { AppEntry } from '../config/content';
import type { SceneState } from './state';

const WEEKDAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;
const MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
] as const;

/** 12-hour clock, "h:mm", no leading zero and no AM/PM. */
export function formatClock(d: Date): string {
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "THURSDAY, NOVEMBER 05", built from fixed English names. */
export function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${day}`;
}

export function counterText(s: SceneState, appCount: number, inputCount: number): string {
  return s.row === 0
    ? `APPS   ${s.selected + 1} / ${appCount}`
    : `INPUTS   ${s.inputSel + 1} / ${inputCount}`;
}

export function printText(app: AppEntry): string {
  return `PRINT   ${app.print}   ·   ${app.palette}`;
}

export const HINT_TEXT = 'ARROWS MOVE   ·   OK OPENS   ·   BACK GOES UP';
