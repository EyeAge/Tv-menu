import { SCENE } from '../config/scene';
import type { SceneState } from '../core/state';
import type { SceneController } from './controller';

/** Developer handle exposed on `window.__tvmenu` when the URL has `debug=1`. */
export interface TvMenuDebug {
  controller: SceneController;
  /** True once the controller exists and the frame loop has started. */
  ready: boolean;
  /** Stop advancing the scene with real time; the frame loop keeps running. */
  pause(): void;
  resume(): void;
  /** Write fields into the state, refresh the text and redraw once. */
  patch(partial: Partial<SceneState>): void;
  /**
   * True when the background queue is idle, every eased value is at its target and the card
   * highlight sweep has finished.
   */
  settled(): boolean;
}

declare global {
  interface Window {
    __tvmenu?: TvMenuDebug;
  }
}

const EPS = 0.001;

export function isSettled(s: SceneState): boolean {
  return (
    !s.bgRunning &&
    s.bgQueue.length === 0 &&
    Math.abs(s.selectedF - s.selected) < EPS &&
    Math.abs(s.scrollF - s.scroll) < EPS &&
    Math.abs(s.inputSelF - s.inputSel) < EPS &&
    s.sweep >= SCENE.sweepMax
  );
}

export function debugRequested(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

/** Length of one averaging window of the `?debug=1` frame-time log. */
export const FRAME_LOG_WINDOW_MS = 5000;

/**
 * Averages frame times for the `?debug=1` console log. Call `record` once per rendered frame with
 * the `performance.now()` times around the render call; it returns a summary line each time a
 * window's worth of frame intervals has elapsed, else null.
 */
export class FrameStats {
  private lastStart: number | null = null;
  private frames = 0;
  private intervalMs = 0;
  private renderMs = 0;

  constructor(private readonly windowMs = FRAME_LOG_WINDOW_MS) {}

  record(start: number, end: number): string | null {
    const last = this.lastStart;
    this.lastStart = start;
    if (last === null) return null;
    this.frames++;
    this.intervalMs += start - last;
    this.renderMs += end - start;
    if (this.intervalMs < this.windowMs) return null;
    const line =
      `avg frame time ${(this.intervalMs / this.frames).toFixed(2)} ms, ` +
      `render call ${(this.renderMs / this.frames).toFixed(2)} ms, ${this.frames} frames`;
    this.frames = 0;
    this.intervalMs = 0;
    this.renderMs = 0;
    return line;
  }
}

/** Installs the handle when requested; returns a disposer. Call after the frame loop has started. */
export function installDebug(controller: SceneController, search: string): () => void {
  if (!debugRequested(search)) return () => {};
  const handle: TvMenuDebug = {
    controller,
    ready: true,
    pause: () => {
      controller.realtime = false;
    },
    resume: () => {
      controller.realtime = true;
    },
    patch: (partial) => {
      Object.assign(controller.state, partial);
      controller.refreshText();
      controller.tick(0);
    },
    settled: () => isSettled(controller.state),
  };
  window.__tvmenu = handle;
  return () => {
    controller.realtime = true;
    if (window.__tvmenu === handle) delete window.__tvmenu;
  };
}
