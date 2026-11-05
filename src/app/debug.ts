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
  /** Write fields into the state and redraw once. */
  patch(partial: Partial<SceneState>): void;
  /** True when the background queue is idle and every eased value is at its target. */
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
    Math.abs(s.inputSelF - s.inputSel) < EPS
  );
}

export function debugRequested(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
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
