import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { SCENE } from '../config/scene';
import { fitStage, type Fit } from '../core/layout';

interface StageProps {
  /** Kept in sync with the current fit so event handlers can map client coordinates. */
  fitRef: RefObject<Fit>;
  children: ReactNode;
}

function windowFit(): Fit {
  return fitStage(window.innerWidth, window.innerHeight);
}

/** Fixed-size logical stage, contain-fitted and centered in the window. */
export default function Stage({ fitRef, children }: StageProps) {
  const [fit, setFit] = useState<Fit>(windowFit);

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
      <canvas id="scene" width={SCENE.stageW} height={SCENE.stageH} />
      {children}
    </div>
  );
}
