import { useCallback, useRef } from 'react';
import type { SceneController } from '../app/controller';
import { SCENE } from '../config/scene';
import { pillX } from '../core/layout';
import type { SceneState } from '../core/state';
import { useFrame } from './useFrame';

const boxLeft = (i: number) => SCENE.inputX0 + SCENE.inputPitch * i;

/**
 * The inputs boxes, the sliding selection frame and the input names, in the original's paint
 * order: the frame covers the boxes, the names sit on top of both.
 */
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
        <div key={name} className="input-box" style={{ left: boxLeft(i) }} />
      ))}
      <div className="input-pill" ref={pill} />
      {controller.inputs.map((name, i) => (
        <div
          key={name}
          className={i === 0 ? 'input-name input-name-current' : 'input-name'}
          style={{ left: boxLeft(i) }}
        >
          {name}
        </div>
      ))}
      <div className="input-cast" style={{ left: boxLeft(0) }}>
        CAST
      </div>
    </>
  );
}
