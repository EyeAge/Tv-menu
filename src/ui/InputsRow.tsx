import { useCallback, useRef } from 'react';
import type { SceneController } from '../app/controller';
import { SCENE } from '../config/scene';
import { pillX } from '../core/layout';
import type { SceneState } from '../core/state';
import { useFrame } from './useFrame';

/** The inputs chips and the sliding selection frame. */
export default function InputsRow({ controller }: { controller: SceneController }) {
  const pill = useRef<HTMLDivElement>(null);

  const update = useCallback((s: SceneState) => {
    const el = pill.current;
    if (!el) return;
    el.style.transform = `translateX(${pillX(s) - SCENE.inputW / 2}px)`;
    el.style.opacity = s.row === 1 ? '1' : '0';
  }, []);
  useFrame(controller, update);

  return (
    <>
      {controller.inputs.map((name, i) => (
        <div
          key={name}
          className="input-chip"
          style={{ left: SCENE.inputX0 + SCENE.inputPitch * i }}
        >
          {i === 0 && <span className="input-cast">CAST</span>}
          {name}
        </div>
      ))}
      <div className="input-pill" ref={pill} />
    </>
  );
}
