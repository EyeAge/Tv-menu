import { useRef, useState } from 'react';
import { SceneController } from './app/controller';
import type { Fit } from './core/layout';
import Stage from './ui/Stage';
import TextLayer from './ui/TextLayer';
import { useFrameLoop, useKeyboard, usePointer } from './ui/hooks';

export default function App() {
  const [controller] = useState(() => new SceneController());
  const fitRef = useRef<Fit>({ scale: 0, left: 0, top: 0 });

  useFrameLoop(controller);
  useKeyboard(controller);
  usePointer(controller, fitRef);

  return (
    <Stage fitRef={fitRef}>
      <TextLayer controller={controller} />
    </Stage>
  );
}
