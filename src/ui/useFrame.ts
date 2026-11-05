import { useEffect } from 'react';
import type { SceneController } from '../app/controller';
import type { SceneState } from '../core/state';

/** Runs `update` once on mount and after every controller tick. */
export function useFrame(controller: SceneController, update: (s: SceneState) => void): void {
  useEffect(() => {
    update(controller.state);
    return controller.onFrame(update);
  }, [controller, update]);
}
