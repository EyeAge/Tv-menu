import { SCENE } from '../config/scene';

/** 0 is the apps row, 1 is the inputs row. */
export type Row = 0 | 1;

/** Result of a pointer hit test; row -1 means nothing was hit. */
export interface Hit {
  row: -1 | 0 | 1;
  index: number;
}

export interface SceneState {
  row: Row;
  selected: number;
  selectedF: number;
  scroll: number;
  scrollF: number;
  inputSel: number;
  inputSelF: number;
  sweep: number;
  time: number;
  bgShown: number;
  bgFrom: number;
  bgTo: number;
  bgT: number;
  bgRunning: boolean;
  bgDir: 1 | -1;
  bgSeed: number;
  bgQueue: number[];
}

export function createState(): SceneState {
  return {
    row: 0,
    selected: 0,
    selectedF: 0,
    scroll: 0,
    scrollF: 0,
    inputSel: 0,
    inputSelF: 0,
    sweep: 0,
    time: 0,
    bgShown: 0,
    bgFrom: 0,
    bgTo: 0,
    bgT: 1,
    bgRunning: false,
    bgDir: 1,
    bgSeed: SCENE.bgSeedInit,
    bgQueue: [],
  };
}
