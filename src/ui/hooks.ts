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
 * the average frame time to the console every 5 seconds. When the WebGL context is lost it stops
 * drawing and drops the renderer; when the context is restored it builds a new one, because every
 * GPU resource, the prints included, is gone. Returns false when WebGL2 is unavailable or the
 * renderer could not be created; in that case nothing is drawn and nothing throws.
 */
export function useSceneRenderer(
  controller: SceneController,
  canvasRef: RefObject<HTMLCanvasElement | null>,
): boolean {
  const [available, setAvailable] = useState(probeWebGL2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!available || !canvas) return;
    const stats = debugRequested(window.location.search) ? new FrameStats() : null;
    let renderer: SceneRenderer | null = null;
    let unsubscribe: (() => void) | null = null;

    const build = () => {
      let created: SceneRenderer | null = null;
      try {
        created = new SceneRenderer(canvas, controller.apps);
        // Draw now, in case the frame loop is paused.
        created.render(controller.state);
      } catch (err) {
        created?.dispose();
        console.error('[tvmenu] could not create the WebGL renderer:', err);
        setAvailable(false);
        return;
      }
      const r = created;
      renderer = r;
      unsubscribe = controller.onFrame((s) => {
        const start = performance.now();
        r.render(s);
        const line = stats?.record(start, performance.now());
        if (line) console.info(`[tvmenu] ${line}`);
      });
    };
    const drop = () => {
      unsubscribe?.();
      unsubscribe = null;
      renderer?.dispose();
      renderer = null;
    };
    const onContextLost = (e: Event) => {
      // Without preventDefault the browser never restores the context.
      e.preventDefault();
      drop();
    };

    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', build);
    build();
    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', build);
      drop();
    };
  }, [controller, canvasRef, available]);

  return available;
}
