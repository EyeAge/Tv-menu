import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { SceneController } from '../app/controller';
import { SCENE } from '../config/scene';
import type { SceneState } from '../core/state';
import { HINT_TEXT, formatClock, formatDate } from '../core/text';
import CardLabels from './CardLabels';
import InputsRow from './InputsRow';
import { useFrame } from './useFrame';

const STATUS_TEXT = 'SMARTCAST   ·   VOL 44';

/** Wall-clock strings, re-checked every second; state only changes when a string does. */
function useClock(): { clock: string; date: string } {
  const read = () => {
    const now = new Date();
    return { clock: formatClock(now), date: formatDate(now) };
  };
  const [value, setValue] = useState(read);
  useEffect(() => {
    const id = setInterval(() => {
      const next = read();
      setValue((prev) => (prev.clock === next.clock && prev.date === next.date ? prev : next));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return value;
}

export default function TextLayer({ controller }: { controller: SceneController }) {
  const text = useSyncExternalStore(controller.subscribeText, controller.getText);
  const { clock, date } = useClock();
  const appsLabels = useRef<HTMLDivElement>(null);

  const dimAppsLabels = useCallback((s: SceneState) => {
    if (appsLabels.current) {
      appsLabels.current.style.opacity = String(s.row === 0 ? 1 : SCENE.appsDim);
    }
  }, []);
  useFrame(controller, dimAppsLabels);

  return (
    <div className="text-layer">
      <div className="clock">{clock}</div>
      <div className="date mono">{date}</div>

      <div className="status-dot" />
      <div className="status mono">{STATUS_TEXT}</div>
      <div className="print mono">{text.print}</div>

      <div className="counter mono">{text.counter}</div>
      <h1 className="title">{text.title}</h1>
      <div className="sub">{text.sub}</div>
      <div className="press">Press OK to open</div>

      {/* The APPS tag and the card names dim together, like the original's AppsLabels group. */}
      <div className="apps-labels" ref={appsLabels}>
        <div className="tag tag-apps mono">APPS</div>
        <CardLabels controller={controller} />
      </div>
      <div className="tag tag-inputs mono">INPUTS</div>
      <InputsRow controller={controller} />

      <div className="hint mono">{HINT_TEXT}</div>
    </div>
  );
}
