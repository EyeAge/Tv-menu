import { useEffect, type RefObject } from 'react';
import type { SceneController } from '../app/controller';
import { mapKey } from '../app/input';
import { clientToStage, type Fit } from '../core/layout';

/** Drives the controller with real frame times. */
export function useFrameLoop(controller: SceneController): void {
  useEffect(() => {
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      controller.tick((now - last) / 1000);
      last = now;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [controller]);
}

/** Window key handler; prevents the default action only for keys the scene handled. */
export function useKeyboard(controller: SceneController): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = mapKey(e.key);
      if (key && controller.key(key)) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controller]);
}

/** Window pointer handlers, converted to stage coordinates. */
export function usePointer(controller: SceneController, fitRef: RefObject<Fit>): void {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = clientToStage(e.clientX, e.clientY, fitRef.current);
      controller.pointerMove(p.x, p.y);
    };
    const onDown = (e: PointerEvent) => {
      const p = clientToStage(e.clientX, e.clientY, fitRef.current);
      controller.pointerDown(p.x, p.y);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [controller, fitRef]);
}
