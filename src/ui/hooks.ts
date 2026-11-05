import { useEffect, useState, type RefObject } from 'react';
import type { SceneController } from '../app/controller';
import { FrameStats, debugRequested } from '../app/debug';
import { mapKey } from '../app/input';
import { clientToStage, type Fit } from '../core/layout';
import { SceneRenderer } from '../gl/SceneRenderer';
import { supportsWebGL2 } from '../gl/webgl';

/**
 * Drives the controller with real frame times. The next frame is requested before the tick runs,
 * so a frame listener that throws does not stop the loop.
 */
export function useFrameLoop(controller: SceneController): void {
  useEffect(() => {
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      id = requestAnimationFrame(loop);
      const dt = (now - last) / 1000;
      last = now;
      if (controller.realtime) controller.tick(dt);
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

function probeWebGL2(): boolean {
  const probe = document.createElement('canvas');
  return supportsWebGL2((id) => probe.getContext(id));
}

/**
 * Creates the WebGL renderer on the stage canvas (its drawing buffer has a fixed size, see
 * `renderBufferSize`), draws once and then after every controller tick. With `?debug=1` it logs
 * the average frame time to the console every 5 seconds. Returns false when WebGL2 is
 * unavailable, in which case no renderer is created.
 */
export function useSceneRenderer(
  controller: SceneController,
  canvasRef: RefObject<HTMLCanvasElement | null>,
): boolean {
  const [supported] = useState(probeWebGL2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!supported || !canvas) return;
    const renderer = new SceneRenderer(canvas, controller.apps);
    // Draw now, in case the frame loop is paused.
    renderer.render(controller.state);
    const stats = debugRequested(window.location.search) ? new FrameStats() : null;
    const unsubscribe = controller.onFrame((s) => {
      const start = performance.now();
      renderer.render(s);
      const line = stats?.record(start, performance.now());
      if (line) console.info(`[tvmenu] ${line}`);
    });
    return () => {
      unsubscribe();
      renderer.dispose();
    };
  }, [controller, canvasRef, supported]);

  return supported;
}
