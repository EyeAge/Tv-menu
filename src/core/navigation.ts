import { SCENE } from '../config/scene';
import type { Hit, SceneState } from './state';

export type Key = 'left' | 'right' | 'up' | 'down' | 'enter' | 'escape' | 'backspace';

/**
 * Select an app card, clamping the index and moving the scroll window the
 * minimum distance. Returns false when the selection did not change.
 */
export function selectApp(s: SceneState, index: number, appCount: number): boolean {
  const i = Math.min(Math.max(index, 0), appCount - 1);
  if (i === s.selected) return false;
  s.selected = i;
  s.sweep = 0;
  if (s.selected < s.scroll) s.scroll = s.selected;
  else if (s.scroll + SCENE.visibleCards - 1 < s.selected) {
    s.scroll = s.selected - SCENE.visibleCards + 1;
  }
  s.bgQueue.push(i);
  return true;
}

/** Apply a key press. Returns true when the key was handled. */
export function handleKey(s: SceneState, key: Key, appCount: number, inputCount: number): boolean {
  if (s.row === 0) {
    switch (key) {
      case 'left':
        selectApp(s, s.selected - 1, appCount);
        return true;
      case 'right':
        selectApp(s, s.selected + 1, appCount);
        return true;
      case 'down':
        s.row = 1;
        return true;
      case 'enter':
        s.sweep = 0;
        return true;
      default:
        return false;
    }
  }
  switch (key) {
    case 'left':
      s.inputSel = Math.max(0, s.inputSel - 1);
      return true;
    case 'right':
      s.inputSel = Math.min(inputCount - 1, s.inputSel + 1);
      return true;
    case 'up':
    case 'escape':
    case 'backspace':
      s.row = 0;
      return true;
    default:
      return false;
  }
}

/** Move focus to the hit target. Returns true when anything changed. */
export function hover(s: SceneState, hit: Hit, appCount: number): boolean {
  if (hit.row === 0 && !(s.row === 0 && hit.index === s.selected)) {
    s.row = 0;
    selectApp(s, hit.index, appCount);
    return true;
  }
  if (hit.row === 1 && !(s.row === 1 && hit.index === s.inputSel)) {
    s.row = 1;
    s.inputSel = hit.index;
    return true;
  }
  return false;
}

/** Clicking the selected card replays the sweep; other hits behave like hover. */
export function pointerDown(s: SceneState, hit: Hit, appCount: number): boolean {
  if (hit.row === 0 && s.row === 0 && hit.index === s.selected) {
    s.sweep = 0;
    return true;
  }
  return hover(s, hit, appCount);
}
