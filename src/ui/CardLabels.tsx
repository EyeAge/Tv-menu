import { useCallback, useRef } from 'react';
import type { SceneController } from '../app/controller';
import { SCENE } from '../config/scene';
import { labelSlots } from '../core/layout';
import type { SceneState } from '../core/state';
import { useFrame } from './useFrame';

/** Card-name labels. Their text, position and opacity are written directly each frame. */
export default function CardLabels({ controller }: { controller: SceneController }) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  const update = useCallback(
    (s: SceneState) => {
      const slots = labelSlots(s, controller.apps.length);
      slots.forEach((slot, i) => {
        const el = refs.current[i];
        if (!el) return;
        const name = slot.alpha > 0 ? controller.apps[slot.index]!.name : '';
        if (el.textContent !== name) el.textContent = name;
        el.style.transform = `translateX(${slot.x}px) translateX(-50%)`;
        el.style.opacity = String(slot.alpha);
      });
    },
    [controller],
  );
  useFrame(controller, update);

  return (
    <>
      {Array.from({ length: SCENE.labelSlots }, (_, i) => (
        <div
          key={i}
          className="card-label"
          ref={(el) => {
            refs.current[i] = el;
          }}
        />
      ))}
    </>
  );
}
