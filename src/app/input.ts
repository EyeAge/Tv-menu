import type { Key } from '../core/navigation';

const KEY_MAP: Record<string, Key> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Enter: 'enter',
  Escape: 'escape',
  Backspace: 'backspace',
};

/** Maps a KeyboardEvent.key value to a scene key, or undefined when it is not one. */
export function mapKey(eventKey: string): Key | undefined {
  return KEY_MAP[eventKey];
}
