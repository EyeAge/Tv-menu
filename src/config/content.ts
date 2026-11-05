export type RGB = readonly [number, number, number]; // 0..255 整数
export type PatternKind = 0 | 1 | 2 | 3 | 4; // 圆点、加号、鳞片、竖条、方块

export interface AppEntry {
  name: string;
  sub: string;
  print: string;
  palette: string;
  glow: RGB;
  colors: readonly [RGB, RGB, RGB, RGB];
  kind: PatternKind;
  seed: number;
  scale: number;
  ink: number;
}

export const APPS: readonly AppEntry[] = [
  {
    name: 'Netflix',
    sub: 'Series and films',
    print: 'VERMILION',
    palette: 'CRIMSON',
    glow: [255, 70, 90],
    colors: [
      [120, 10, 30],
      [225, 40, 60],
      [40, 8, 20],
      [255, 205, 210],
    ],
    kind: 1,
    seed: 0.3,
    scale: 9,
    ink: 0.9,
  },
  {
    name: 'YouTube',
    sub: 'Videos, music, live',
    print: 'ORCHARD',
    palette: 'TANGERINE',
    glow: [255, 150, 60],
    colors: [
      [80, 30, 10],
      [235, 130, 40],
      [250, 215, 160],
      [60, 25, 10],
    ],
    kind: 0,
    seed: 1.1,
    scale: 8,
    ink: 0.8,
  },
  {
    name: 'Prime Video',
    sub: 'Films, series and sport',
    print: 'KOI POND',
    palette: 'LAGOON',
    glow: [90, 220, 220],
    colors: [
      [20, 120, 125],
      [190, 165, 110],
      [30, 160, 170],
      [30, 30, 35],
    ],
    kind: 2,
    seed: 2.2,
    scale: 10,
    ink: 0.7,
  },
  {
    name: 'Disney+',
    sub: 'Stories for everyone',
    print: 'AFTER HOURS',
    palette: 'ROYAL',
    glow: [110, 130, 255],
    colors: [
      [20, 30, 120],
      [70, 90, 230],
      [225, 205, 90],
      [25, 30, 90],
    ],
    kind: 0,
    seed: 3.3,
    scale: 7,
    ink: 0.6,
  },
  {
    name: 'Hulu',
    sub: 'Next-day TV',
    print: 'MOSS',
    palette: 'EMERALD',
    glow: [60, 230, 140],
    colors: [
      [10, 60, 40],
      [25, 150, 90],
      [120, 220, 160],
      [10, 35, 25],
    ],
    kind: 3,
    seed: 4.4,
    scale: 9,
    ink: 0.8,
  },
  {
    name: 'HBO Max',
    sub: 'Prestige drama',
    print: 'VELVET',
    palette: 'VIOLET',
    glow: [170, 110, 255],
    colors: [
      [45, 20, 110],
      [110, 70, 220],
      [190, 170, 240],
      [30, 15, 70],
    ],
    kind: 1,
    seed: 5.5,
    scale: 8,
    ink: 0.7,
  },
  {
    name: 'Apple TV+',
    sub: 'Originals',
    print: 'GRAPHITE',
    palette: 'SILVER',
    glow: [230, 230, 240],
    colors: [
      [20, 20, 22],
      [90, 92, 98],
      [215, 215, 220],
      [240, 240, 240],
    ],
    kind: 4,
    seed: 6.6,
    scale: 11,
    ink: 0.9,
  },
  {
    name: 'Peacock',
    sub: 'Shows, news and sport',
    print: 'PLUMAGE',
    palette: 'GOLD',
    glow: [255, 215, 90],
    colors: [
      [15, 70, 70],
      [210, 170, 70],
      [40, 150, 140],
      [25, 25, 20],
    ],
    kind: 2,
    seed: 7.7,
    scale: 9,
    ink: 0.85,
  },
  {
    name: 'Plex',
    sub: 'Your own library',
    print: 'MEADOW',
    palette: 'LIME',
    glow: [200, 240, 60],
    colors: [
      [40, 60, 15],
      [150, 190, 40],
      [60, 110, 30],
      [20, 30, 10],
    ],
    kind: 0,
    seed: 8.8,
    scale: 10,
    ink: 0.9,
  },
  {
    name: 'Tubi',
    sub: 'Free films',
    print: 'SALMON',
    palette: 'ORCHID',
    glow: [255, 120, 200],
    colors: [
      [90, 20, 60],
      [240, 170, 160],
      [220, 60, 170],
      [60, 15, 40],
    ],
    kind: 3,
    seed: 9.9,
    scale: 12,
    ink: 0.6,
  },
];

export const INPUTS: readonly string[] = ['SMARTCAST', 'HDMI-1', 'HDMI-2', 'COMP', 'TV'];

export function rgb01(c: RGB): [number, number, number] {
  return [c[0] / 255, c[1] / 255, c[2] / 255];
}
