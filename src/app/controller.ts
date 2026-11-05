import { APPS, INPUTS, type AppEntry } from '../config/content';
import { advance } from '../core/advance';
import { handleKey, hover, pointerDown, type Key } from '../core/navigation';
import { hitTest } from '../core/layout';
import { createState, type SceneState } from '../core/state';
import { counterText, printText } from '../core/text';

export interface SceneText {
  title: string;
  sub: string;
  counter: string;
  print: string;
}

export interface ControllerOptions {
  apps?: readonly AppEntry[];
  inputs?: readonly string[];
  random?: () => number;
}

/** Owns the scene state and exposes it to the UI; free of React and DOM APIs. */
export class SceneController {
  readonly state: SceneState = createState();
  readonly apps: readonly AppEntry[];
  readonly inputs: readonly string[];
  /** When false the frame loop must not advance the scene with real elapsed time. */
  realtime = true;
  private readonly random: () => number;
  private text: SceneText;
  private readonly textListeners = new Set<() => void>();
  private readonly frameListeners = new Set<(s: SceneState) => void>();

  constructor(opts: ControllerOptions = {}) {
    this.apps = opts.apps ?? APPS;
    this.inputs = opts.inputs ?? INPUTS;
    this.random = opts.random ?? Math.random;
    this.text = this.computeText();
  }

  key(key: Key): boolean {
    const handled = handleKey(this.state, key, this.apps.length, this.inputs.length);
    if (handled) this.refreshText();
    return handled;
  }

  pointerMove(stageX: number, stageY: number): void {
    const hit = this.hit(stageX, stageY);
    if (hover(this.state, hit, this.apps.length)) this.refreshText();
  }

  pointerDown(stageX: number, stageY: number): void {
    const hit = this.hit(stageX, stageY);
    if (pointerDown(this.state, hit, this.apps.length)) this.refreshText();
  }

  tick(dt: number): void {
    advance(this.state, dt, this.random);
    for (const fn of this.frameListeners) fn(this.state);
  }

  getText = (): SceneText => this.text;

  subscribeText = (fn: () => void): (() => void) => {
    this.textListeners.add(fn);
    return () => {
      this.textListeners.delete(fn);
    };
  };

  onFrame(fn: (s: SceneState) => void): () => void {
    this.frameListeners.add(fn);
    return () => {
      this.frameListeners.delete(fn);
    };
  }

  private hit(x: number, y: number) {
    return hitTest(this.state, x, y, this.apps.length, this.inputs.length);
  }

  /** The print line follows the selected app, which does not change on the inputs row. */
  private computeText(): SceneText {
    const s = this.state;
    const counter = counterText(s, this.apps.length, this.inputs.length);
    const app = this.apps[s.selected]!;
    const print = printText(app);
    if (s.row === 0) return { title: app.name, sub: app.sub, counter, print };
    const name = this.inputs[s.inputSel]!;
    return { title: name, sub: name, counter, print };
  }

  private refreshText(): void {
    const next = this.computeText();
    const prev = this.text;
    if (
      next.title === prev.title &&
      next.sub === prev.sub &&
      next.counter === prev.counter &&
      next.print === prev.print
    ) {
      return;
    }
    this.text = next;
    for (const fn of this.textListeners) fn();
  }
}
