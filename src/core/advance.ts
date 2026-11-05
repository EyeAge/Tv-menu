import { SCENE } from '../config/scene';
import type { SceneState } from './state';

/**
 * Advances the scene by one frame: eases continuous values, moves the highlight
 * sweep and runs the FIFO background transition queue. At most one background
 * event happens per call: either the running transition advances, or one queue
 * entry is taken (and dropped if it equals the image already shown).
 */
export function advance(s: SceneState, dt: number, random: () => number = Math.random): void {
  const d = Math.min(dt, SCENE.maxDt);
  s.time += d;

  const k = 1 - Math.exp(-SCENE.rateSelect * d);
  s.selectedF += (s.selected - s.selectedF) * k;
  s.scrollF += (s.scroll - s.scrollF) * (1 - Math.exp(-SCENE.rateScroll * d));
  s.inputSelF += (s.inputSel - s.inputSelF) * k;
  s.sweep = Math.min(SCENE.sweepMax, s.sweep + d * SCENE.sweepSpeed);

  if (s.bgRunning) {
    s.bgT = Math.min(1, s.bgT + d / SCENE.bgDuration);
    if (s.bgT >= 1) {
      s.bgRunning = false;
      s.bgShown = s.bgTo;
      s.bgFrom = s.bgTo;
    }
  } else {
    const next = s.bgQueue.shift();
    if (next !== undefined && next !== s.bgShown) {
      s.bgFrom = s.bgShown;
      s.bgTo = next;
      s.bgDir = s.bgShown < next ? 1 : -1;
      s.bgSeed = random();
      s.bgT = 0;
      s.bgRunning = true;
    }
  }
}
