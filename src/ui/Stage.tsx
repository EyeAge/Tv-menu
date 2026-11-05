import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { SceneController } from '../app/controller';
import { SCENE } from '../config/scene';
import { fitStage, type Fit } from '../core/layout';
import { useSceneRenderer } from './hooks';

interface StageProps {
  controller: SceneController;
  /** Kept in sync with the current fit so event handlers can map client coordinates. */
  fitRef: RefObject<Fit>;
  children: ReactNode;
}

function windowFit(): Fit {
  return fitStage(window.innerWidth, window.innerHeight);
}

/** Fixed-size logical stage with the WebGL canvas, contain-fitted and centered in the window. */
export default function Stage({ controller, fitRef, children }: StageProps) {
  const [fit, setFit] = useState<Fit>(windowFit);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webgl = useSceneRenderer(controller, canvasRef);

  useLayoutEffect(() => {
    const onResize = () => setFit(windowFit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    fitRef.current = fit;
  }, [fit, fitRef]);

  return (
    <div
      className="stage"
      style={{
        width: SCENE.stageW,
        height: SCENE.stageH,
        transform: `translate(${fit.left}px, ${fit.top}px) scale(${fit.scale})`,
      }}
    >
      <canvas id="scene" ref={canvasRef} />
      {!webgl && <div className="webgl-missing">WebGL2 is not available</div>}
      {children}
    </div>
  );
}
