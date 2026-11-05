# TV Menu 网页复刻 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 gmgn.monster 的 Rive "TV Menu" 场景移植成一个 Vite + React + three.js 的静态网页，1440×900 下与原站并排肉眼看不出明显差别，并自动部署到 GitHub Pages。

**Architecture:** 一个不依赖 React 和 three.js 的纯逻辑核心（状态、导航、每帧推进、布局与命中测试），按原作脚本逐条移植，用单元测试钉住。一个 three.js 渲染器在单个 WebGL2 画布上依次画背景（四分之一分辨率后放大）、卡片倒影、卡片、颗粒。React 只负责 1280×720 舞台容器和 DOM 文字层；逐帧变化的 DOM 属性由帧回调直接写，不触发 React 重渲染。

**Tech Stack:** pnpm、Node 24、Vite、React、TypeScript、three.js、GLSL ES 3.00、Vitest、ESLint、Prettier、Playwright（只用于截图对比）、GitHub Actions。

**Spec:** `docs/superpowers/specs/2026-11-05-tv-menu-replica-design.md`

**本地参考（不进仓库，只存在于开发机）：** `.reference/extracted/scene-spec.md` 是原作逻辑的完整伪代码，`.reference/shaders/*.wgsl` 是原作四个着色器，`.reference/extracted/apps.json` 是应用参数，`.reference/screenshots/` 是基准截图，`.reference/LOCAL-NOTES.md` 是本机网络配置。

## Global Constraints

- 逻辑舞台固定 1280×720，等比缩放居中，舞台外底色 `#07090c`。
- 所有内容（应用、输入源、印花参数）只来自 `src/config/content.ts`。组件和着色器里不得出现应用名或颜色字面量。
- 所有文字用 DOM 渲染，不画进画布。
- 运行时不请求任何外部域名。字体文件放在仓库里。
- 需要 WebGL2。不支持时在页面中央显示一行 `WebGL2 is not available`，不抛异常。
- `.reference/`、`compare/`、`node_modules/`、`dist/` 不得提交。
- 原作的片元坐标和纹理坐标原点在左上、y 向下。移植每个着色器时：片元坐标用 `vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y)`；按原作 uv 采样纹理时用 `texture(tex, vec2(uv.x, 1.0 - uv.y))`。
- 不做任何色彩空间转换：`THREE.ColorManagement.enabled = false`，`renderer.outputColorSpace = THREE.LinearSRGBColorSpace`，着色器输出什么屏幕就显示什么。
- 着色器里的常数照抄 `.reference/shaders/*.wgsl`，不要"改进"。浮点一律 `highp`。
- 直接提交到 `main`，小步提交。提交信息英文，Conventional Commits，结尾加一行 `Co-Authored-By:`，用各子代理自己的系统指令给出的那一行（实施中改动，原为指定的 `Claude Fable 5.1` 一行）。
- README 英文；`docs/notes/` 中文。
- 桌面 Chrome、Safari、Firefox 最新版。WebGL 绘图缓冲固定为 1280×720，与设备像素比无关（实施中改动，原为设备像素比上限取 2）。

## Review Focus

规格没有逐条写明、但真实使用中最容易出问题的五种情况。每条的测试已加到对应任务里。

1. **按住方向键连发。** 背景队列必须按顺序逐个播完，不跳变、不卡死，最后停在最终选中项。（Task 4）
2. **切走标签页再回来，或某一帧卡了几秒。** 动画不能瞬移，单帧步长上限 0.05 秒。（Task 4）
3. **窗口被拖成极端比例或尺寸为 0。** 舞台缩放不能出现 NaN 或 Infinity。（Task 5）
4. **鼠标在舞台外的黑边上移动或点击。** 不能选中任何东西，也不能报错。（Task 5）
5. **时钟的边界值。** 0 点显示 `12:05` 而不是 `0:05`，13 点显示 `1:07`，日期的"日"补零到两位。（Task 6）

## 文件结构

```
index.html                     页面壳
vite.config.ts                 base=/Tv-menu/，Vitest 配置
eslint.config.js  .prettierrc.json  tsconfig.json  tsconfig.node.json
.github/workflows/deploy.yml   推 main 发布到 GitHub Pages
README.md                      英文说明，含移植声明和原作致谢
docs/notes/01..05-*.md         五篇中文学习笔记
scripts/capture.mjs            用 Playwright 给复刻版截图
scripts/compare-page.mjs       生成原站与复刻版的并排对比页
src/main.tsx  src/App.tsx  src/styles.css
src/config/content.ts          应用和输入源，唯一的内容来源
src/config/scene.ts            场景数值常量
src/core/state.ts              SceneState、Hit、createState
src/core/navigation.ts         selectApp、handleKey、hover、pointerDown
src/core/advance.ts            每帧推进：缓动、高光、背景队列
src/core/layout.ts             卡片投影矩形、命中测试、标签槽位、舞台缩放
src/core/text.ts               时钟、日期、计数、印花行的文本格式化
src/app/controller.ts          SceneController：持有状态，分发事件和帧回调
src/gl/SceneRenderer.ts        three 渲染器，编排四个通道，处理尺寸
src/gl/prints.ts               10 张印花纹理
src/gl/background.ts           背景通道
src/gl/cards.ts                卡片与倒影通道
src/gl/grain.ts                颗粒通道
src/gl/shaders/*.glsl          common、fullscreen.vert、print.frag、background.frag、card.vert、card.frag、grain.frag、copy.frag
src/ui/Stage.tsx               1280×720 舞台容器和缩放
src/ui/TextLayer.tsx           时钟、状态行、标题区、提示
src/ui/CardLabels.tsx          6 个卡片名标签
src/ui/InputsRow.tsx           输入源方块和选中框
src/assets/fonts/              woff2 字体和 OFL 协议文本
```

测试文件和源码放在一起，命名 `*.test.ts`。

---

### Task 1: 工程脚手架

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/smoke.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: 命令 `pnpm dev`、`pnpm build`、`pnpm preview`、`pnpm lint`、`pnpm test`、`pnpm format`。后续所有任务用这些命令验证。

- [ ] **Step 1: 把文档分支并入 main**

```bash
git checkout main && git merge --ff-only docs/design && git push origin main
```

Expected: `main` 包含 `docs/superpowers/` 下的设计文档和本计划。

- [ ] **Step 2: 初始化工程并安装依赖**

用 `pnpm` 初始化，`"type": "module"`，`"private": true`，包名 `tv-menu`。运行时依赖：`react`、`react-dom`、`three`。开发依赖：`vite`、`@vitejs/plugin-react`、`typescript`、`@types/react`、`@types/react-dom`、`@types/three`、`vitest`、`eslint`、`@eslint/js`、`typescript-eslint`、`eslint-plugin-react-hooks`、`globals`、`prettier`。全部装当前最新稳定版。如果 `typescript-eslint` 的 peer 范围不包含最新的 TypeScript，就把 TypeScript 降到它支持的最高版本。

- [ ] **Step 3: 写配置**

- `vite.config.ts`：`base: '/Tv-menu/'`，React 插件，`test: { environment: 'node', include: ['src/**/*.test.ts'] }`。
- `tsconfig.json`：`strict: true`，`noUncheckedIndexedAccess: true`，`jsx: 'react-jsx'`，`moduleResolution: 'bundler'`，`types: ['vite/client']`。
- `eslint.config.js`：flat config，`@eslint/js` 推荐 + `typescript-eslint` 推荐 + `react-hooks` 推荐，忽略 `dist`、`compare`、`.reference`。
- `.prettierrc.json`：`{ "singleQuote": true, "printWidth": 100 }`。
- `package.json` scripts：`dev: vite`，`build: tsc --noEmit && vite build`，`preview: vite preview`，`lint: eslint . && prettier --check .`，`format: prettier --write .`，`test: vitest run`。
- `.gitignore` 追加一行 `compare/`。
- `.prettierignore`：`dist`、`compare`、`.reference`、`pnpm-lock.yaml`、`docs/superpowers`。

- [ ] **Step 4: 写页面壳**

`index.html`：`<title>TV Menu</title>`，`lang="en"`，viewport meta，一个 `<div id="root">`。`src/styles.css`：`html, body, #root { margin: 0; height: 100%; background: #07090c; overflow: hidden; }`。`src/App.tsx` 先返回一个空的 `<div />`。

- [ ] **Step 5: 写冒烟测试并验证全套命令**

```ts
// src/smoke.test.ts
import { expect, test } from 'vitest';
test('toolchain runs', () => {
  expect(1 + 1).toBe(2);
});
```

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 三个命令都成功，`dist/index.html` 存在且其中的资源路径以 `/Tv-menu/` 开头。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite React TypeScript project"
```

---

### Task 2: 内容与场景常量

**Files:**
- Create: `src/config/content.ts`, `src/config/scene.ts`, `src/config/content.test.ts`

**Interfaces:**
- Produces:

```ts
// content.ts
export type RGB = readonly [number, number, number]; // 0..255 整数
export type PatternKind = 0 | 1 | 2 | 3 | 4; // 圆点、加号、鳞片、竖条、方块
export interface AppEntry {
  name: string; sub: string; print: string; palette: string;
  glow: RGB; colors: readonly [RGB, RGB, RGB, RGB];
  kind: PatternKind; seed: number; scale: number; ink: number;
}
export const APPS: readonly AppEntry[];
export const INPUTS: readonly string[];
export function rgb01(c: RGB): [number, number, number]; // 每个分量除以 255

// scene.ts
export const SCENE: {
  stageW: 1280; stageH: 720; visibleCards: 5;
  halfHeightAtOrigin: 1.607695; cameraZ: 6; fovY: 0.523599; near: 0.1; far: 50;
  cardSpacing: 1.07; cardOriginX: -1.98; cardY: -0.49;
  cardHalfW: 0.5; cardHalfH: 0.3; cardHalfD: 0.03;
  scaleBase: 0.86; scaleFocus: 0.16; zFocus: 0.25; rotYPerX: 0.11;
  cullX: 3.4; floorGap: 0.02; glowHeightK: 0.6;
  rateSelect: 9; rateScroll: 7; maxDt: 0.05;
  sweepMax: 2.2; sweepSpeed: 2.4; bgDuration: 1.1; bgSeedInit: 0.37;
  glowYWorld: -0.99; rowDimGlow: 0.35; rowDimCard: 0.45; rowDimLabel: 0.5; appsDim: 0.45;
  labelSlots: 6; labelAlphaBase: 0.35; labelAlphaFocus: 0.65; labelFadeStart: 2.3; labelFadeWidth: 0.5;
  inputX0: 60; inputPitch: 160; inputW: 150; inputTop: 606; inputBottom: 656; pillX0: 136;
  printW: 640; printH: 400; bgDownscale: 4; grain: 0.07;
};
```

- [ ] **Step 1: 写失败的测试**

```ts
// src/config/content.test.ts
import { expect, test } from 'vitest';
import { APPS, INPUTS, rgb01 } from './content';

test('ten apps and five inputs in the original order', () => {
  expect(APPS.map((a) => a.name)).toEqual([
    'Netflix', 'YouTube', 'Prime Video', 'Disney+', 'Hulu',
    'HBO Max', 'Apple TV+', 'Peacock', 'Plex', 'Tubi',
  ]);
  expect(INPUTS).toEqual(['SMARTCAST', 'HDMI-1', 'HDMI-2', 'COMP', 'TV']);
});

test('print parameters match the original', () => {
  expect(APPS.map((a) => [a.kind, a.seed, a.scale, a.ink])).toEqual([
    [1, 0.3, 9, 0.9], [0, 1.1, 8, 0.8], [2, 2.2, 10, 0.7], [0, 3.3, 7, 0.6], [3, 4.4, 9, 0.8],
    [1, 5.5, 8, 0.7], [4, 6.6, 11, 0.9], [2, 7.7, 9, 0.85], [0, 8.8, 10, 0.9], [3, 9.9, 12, 0.6],
  ]);
});

test('colors are 0..255 integers and rgb01 normalizes', () => {
  for (const a of APPS) {
    for (const c of [a.glow, ...a.colors]) {
      for (const v of c) expect(Number.isInteger(v) && v >= 0 && v <= 255).toBe(true);
    }
  }
  expect(APPS[0]!.glow).toEqual([255, 70, 90]);
  expect(APPS[9]!.colors[2]).toEqual([220, 60, 170]);
  expect(rgb01([255, 0, 51])).toEqual([1, 0, 0.2]);
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm test`
Expected: FAIL，找不到 `./content`。

- [ ] **Step 3: 写 `content.ts` 和 `scene.ts`**

`scene.ts` 照 Interfaces 里的值原样导出，`as const`。`content.ts` 的数据如下，`sub`、`print`、`palette` 见规格 4.3 的表，`kind`、`seed`、`scale`、`ink` 见上面的测试：

| 应用 | glow | colors[0] | colors[1] | colors[2] | colors[3] |
|---|---|---|---|---|---|
| Netflix | 255,70,90 | 120,10,30 | 225,40,60 | 40,8,20 | 255,205,210 |
| YouTube | 255,150,60 | 80,30,10 | 235,130,40 | 250,215,160 | 60,25,10 |
| Prime Video | 90,220,220 | 20,120,125 | 190,165,110 | 30,160,170 | 30,30,35 |
| Disney+ | 110,130,255 | 20,30,120 | 70,90,230 | 225,205,90 | 25,30,90 |
| Hulu | 60,230,140 | 10,60,40 | 25,150,90 | 120,220,160 | 10,35,25 |
| HBO Max | 170,110,255 | 45,20,110 | 110,70,220 | 190,170,240 | 30,15,70 |
| Apple TV+ | 230,230,240 | 20,20,22 | 90,92,98 | 215,215,220 | 240,240,240 |
| Peacock | 255,215,90 | 15,70,70 | 210,170,70 | 40,150,140 | 25,25,20 |
| Plex | 200,240,60 | 40,60,15 | 150,190,40 | 60,110,30 | 20,30,10 |
| Tubi | 255,120,200 | 90,20,60 | 240,170,160 | 220,60,170 | 60,15,40 |

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm test && pnpm lint`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/config && git commit -m "feat: add content and scene constants"
```

---

### Task 3: 状态与导航

**Files:**
- Create: `src/core/state.ts`, `src/core/navigation.ts`, `src/core/navigation.test.ts`

**Interfaces:**
- Consumes: `SCENE`（Task 2）。
- Produces:

```ts
// state.ts
export type Row = 0 | 1; // 0 应用行，1 Inputs 行
export interface Hit { row: -1 | 0 | 1; index: number }
export interface SceneState {
  row: Row;
  selected: number; selectedF: number;
  scroll: number; scrollF: number;
  inputSel: number; inputSelF: number;
  sweep: number; time: number;
  bgShown: number; bgFrom: number; bgTo: number; bgT: number;
  bgRunning: boolean; bgDir: 1 | -1; bgSeed: number; bgQueue: number[];
}
export function createState(): SceneState;

// navigation.ts：全部原地修改 state，返回值表示"是否处理了/是否有变化"
export type Key = 'left' | 'right' | 'up' | 'down' | 'enter' | 'escape' | 'backspace';
export function selectApp(s: SceneState, index: number, appCount: number): boolean;
export function handleKey(s: SceneState, key: Key, appCount: number, inputCount: number): boolean;
export function hover(s: SceneState, hit: Hit, appCount: number): boolean;
export function pointerDown(s: SceneState, hit: Hit, appCount: number): boolean;
```

逻辑逐条对应 `.reference/extracted/scene-spec.md` 的 selectApp、keyboardEvent、hover、pointerDown。

- [ ] **Step 1: 写失败的测试**

```ts
// src/core/navigation.test.ts
import { describe, expect, test } from 'vitest';
import { createState } from './state';
import { handleKey, hover, pointerDown, selectApp } from './navigation';

const N = 10;
const M = 5;

test('initial state', () => {
  expect(createState()).toEqual({
    row: 0, selected: 0, selectedF: 0, scroll: 0, scrollF: 0, inputSel: 0, inputSelF: 0,
    sweep: 0, time: 0, bgShown: 0, bgFrom: 0, bgTo: 0, bgT: 1, bgRunning: false,
    bgDir: 1, bgSeed: 0.37, bgQueue: [],
  });
});

describe('selectApp', () => {
  test('clamps at both ends and is a no-op when unchanged', () => {
    const s = createState();
    expect(selectApp(s, -1, N)).toBe(false);
    expect(s.selected).toBe(0);
    expect(s.bgQueue).toEqual([]);
    expect(selectApp(s, 99, N)).toBe(true);
    expect(s.selected).toBe(9);
    expect(selectApp(s, 10, N)).toBe(false);
  });

  test('resets sweep and queues the background', () => {
    const s = createState();
    s.sweep = 2.2;
    selectApp(s, 3, N);
    expect(s.sweep).toBe(0);
    expect(s.bgQueue).toEqual([3]);
  });

  test('scroll window moves the minimum distance', () => {
    const s = createState();
    const scrolls: number[] = [];
    for (let i = 1; i <= 9; i++) { selectApp(s, i, N); scrolls.push(s.scroll); }
    expect(scrolls).toEqual([0, 0, 0, 0, 1, 2, 3, 4, 5]);
    const back: number[] = [];
    for (let i = 8; i >= 0; i--) { selectApp(s, i, N); back.push(s.scroll); }
    expect(back).toEqual([5, 5, 5, 5, 4, 3, 2, 1, 0]);
  });
});

describe('handleKey on the apps row', () => {
  test('left and right move, down enters inputs, enter replays the sweep', () => {
    const s = createState();
    expect(handleKey(s, 'right', N, M)).toBe(true);
    expect(s.selected).toBe(1);
    expect(handleKey(s, 'left', N, M)).toBe(true);
    expect(s.selected).toBe(0);
    s.sweep = 2.2;
    expect(handleKey(s, 'enter', N, M)).toBe(true);
    expect(s.sweep).toBe(0);
    expect(s.bgQueue).toEqual([1, 0]);
    expect(handleKey(s, 'down', N, M)).toBe(true);
    expect(s.row).toBe(1);
  });

  test('up, escape and backspace are not handled', () => {
    const s = createState();
    for (const k of ['up', 'escape', 'backspace'] as const) expect(handleKey(s, k, N, M)).toBe(false);
    expect(s.row).toBe(0);
  });
});

describe('handleKey on the inputs row', () => {
  test('left and right clamp; up, escape, backspace return to apps', () => {
    const s = createState();
    s.row = 1;
    handleKey(s, 'left', N, M);
    expect(s.inputSel).toBe(0);
    for (let i = 0; i < 9; i++) handleKey(s, 'right', N, M);
    expect(s.inputSel).toBe(4);
    for (const k of ['up', 'escape', 'backspace'] as const) {
      s.row = 1;
      expect(handleKey(s, k, N, M)).toBe(true);
      expect(s.row).toBe(0);
    }
    expect(s.inputSel).toBe(4);
  });

  test('down and enter are not handled and change nothing', () => {
    const s = createState();
    s.row = 1; s.sweep = 2.2;
    expect(handleKey(s, 'down', N, M)).toBe(false);
    expect(handleKey(s, 'enter', N, M)).toBe(false);
    expect(s.row).toBe(1);
    expect(s.sweep).toBe(2.2);
    expect(s.selected).toBe(0);
  });
});

describe('pointer', () => {
  test('hover selects across rows and ignores misses', () => {
    const s = createState();
    expect(hover(s, { row: -1, index: 0 }, N)).toBe(false);
    expect(hover(s, { row: 0, index: 0 }, N)).toBe(false);
    expect(hover(s, { row: 1, index: 2 }, N)).toBe(true);
    expect([s.row, s.inputSel]).toEqual([1, 2]);
    expect(hover(s, { row: 0, index: 0 }, N)).toBe(true);
    expect([s.row, s.selected]).toEqual([0, 0]);
    expect(hover(s, { row: 0, index: 4 }, N)).toBe(true);
    expect(s.selected).toBe(4);
  });

  test('clicking the selected card replays the sweep; other clicks behave like hover', () => {
    const s = createState();
    s.sweep = 2.2;
    expect(pointerDown(s, { row: 0, index: 0 }, N)).toBe(true);
    expect(s.sweep).toBe(0);
    expect(s.bgQueue).toEqual([]);
    pointerDown(s, { row: 0, index: 2 }, N);
    expect(s.selected).toBe(2);
    pointerDown(s, { row: 1, index: 3 }, N);
    expect([s.row, s.inputSel]).toEqual([1, 3]);
    s.sweep = 2.2;
    pointerDown(s, { row: 0, index: 2 }, N);
    expect([s.row, s.sweep]).toEqual([0, 2.2]);
    expect(pointerDown(s, { row: -1, index: 0 }, N)).toBe(false);
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm test src/core/navigation.test.ts`
Expected: FAIL，找不到模块。

- [ ] **Step 3: 实现 `state.ts` 和 `navigation.ts`**

按 Interfaces 的签名实现。`hover` 在命中应用行且"焦点已在应用行并且就是当前选中项"时返回 false；从 Inputs 行悬停回当前选中的卡片时只切回 `row = 0`，不入队。

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm test && pnpm lint`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/core && git commit -m "feat: add scene state and navigation logic"
```

---

### Task 4: 每帧推进

**Files:**
- Create: `src/core/advance.ts`, `src/core/advance.test.ts`

**Interfaces:**
- Consumes: `SceneState`、`createState`、`selectApp`（Task 3），`SCENE`（Task 2）。
- Produces: `export function advance(s: SceneState, dt: number, random?: () => number): void;` `random` 默认 `Math.random`。对应 scene-spec 的 advance 一节中标签之前的部分。

- [ ] **Step 1: 写失败的测试**

```ts
// src/core/advance.test.ts
import { expect, test } from 'vitest';
import { createState } from './state';
import { selectApp } from './navigation';
import { advance } from './advance';

const run = (s: ReturnType<typeof createState>, seconds: number, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) advance(s, dt, () => 0.5);
};

test('exponential easing uses rate 9 for selection and 7 for scroll', () => {
  const s = createState();
  s.selected = 1; s.scroll = 1; s.inputSel = 1;
  advance(s, 1 / 60, () => 0.5);
  expect(s.selectedF).toBeCloseTo(0.139292, 6);
  expect(s.inputSelF).toBeCloseTo(0.139292, 6);
  expect(s.scrollF).toBeCloseTo(0.110118, 6);
  expect(s.time).toBeCloseTo(1 / 60, 9);
});

test('a long frame is clamped to 0.05 s (Review Focus 2)', () => {
  const s = createState();
  s.selected = 1; s.scroll = 1;
  advance(s, 5, () => 0.5);
  expect(s.time).toBeCloseTo(0.05, 9);
  expect(s.selectedF).toBeCloseTo(0.362372, 6);
  expect(s.scrollF).toBeCloseTo(0.295312, 6);
});

test('sweep advances at 2.4 per second and stops at 2.2', () => {
  const s = createState();
  advance(s, 0.05, () => 0.5);
  expect(s.sweep).toBeCloseTo(0.12, 9);
  run(s, 2);
  expect(s.sweep).toBe(2.2);
});

test('background transition starts from the queue and lasts 1.1 s', () => {
  const s = createState();
  selectApp(s, 3, 10);
  advance(s, 1 / 60, () => 0.25);
  expect([s.bgRunning, s.bgFrom, s.bgTo, s.bgDir, s.bgSeed, s.bgT]).toEqual([true, 0, 3, 1, 0.25, 0]);
  expect(s.bgQueue).toEqual([]);
  run(s, 1.0);
  expect(s.bgRunning).toBe(true);
  run(s, 0.2);
  expect([s.bgRunning, s.bgShown, s.bgFrom, s.bgTo, s.bgT]).toEqual([false, 3, 3, 3, 1]);
});

test('direction is -1 when moving to a lower index', () => {
  const s = createState();
  s.selected = 5; s.bgShown = 5; s.bgFrom = 5; s.bgTo = 5;
  selectApp(s, 2, 10);
  advance(s, 1 / 60, () => 0.5);
  expect(s.bgDir).toBe(-1);
});

test('an entry equal to what is shown is dropped without a transition', () => {
  const s = createState();
  s.bgQueue.push(0);
  advance(s, 1 / 60, () => 0.5);
  expect([s.bgRunning, s.bgQueue.length]).toEqual([false, 0]);
});

test('held key: queue drains in order and ends on the final selection (Review Focus 1)', () => {
  const s = createState();
  const seen: number[] = [];
  for (let i = 1; i <= 9; i++) selectApp(s, i, 10);
  expect(s.bgQueue).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let f = 0; f < 60 * 12; f++) {
    advance(s, 1 / 60, () => 0.5);
    if (s.bgRunning && seen[seen.length - 1] !== s.bgTo) seen.push(s.bgTo);
  }
  expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect([s.bgRunning, s.bgShown, s.bgQueue.length]).toEqual([false, 9, 0]);
  expect(s.selectedF).toBeCloseTo(9, 3);
  expect(s.scrollF).toBeCloseTo(5, 3);
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm test src/core/advance.test.ts`
Expected: FAIL，找不到 `./advance`。

- [ ] **Step 3: 实现 `advance`**

每次调用最多做一件背景事：要么推进正在进行的过渡，要么从队列取一项。取出的项等于 `bgShown` 时丢弃，本帧不再取下一项。

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm test && pnpm lint`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/core && git commit -m "feat: add per-frame advance with easing and background queue"
```

---

### Task 5: 布局、命中测试与舞台缩放

**Files:**
- Create: `src/core/layout.ts`, `src/core/layout.test.ts`

**Interfaces:**
- Consumes: `SceneState`、`Hit`、`createState`（Task 3），`SCENE`（Task 2）。
- Produces:

```ts
export const PPU: number; // (stageH / 2) / halfHeightAtOrigin = 223.9231...
export function cardX(index: number, scrollF: number): number; // 世界坐标 x
export function focus(index: number, selectedF: number): number; // 0..1
export interface Rect { cx: number; cy: number; halfW: number; halfH: number } // 舞台像素
export function cardRect(s: SceneState, index: number): Rect;
export function hitTest(s: SceneState, x: number, y: number, appCount: number, inputCount: number): Hit;
export interface LabelSlot { index: number; x: number; alpha: number } // index 越界时 alpha 为 0
export function labelSlots(s: SceneState, appCount: number): LabelSlot[]; // 长度 6
export function pillX(s: SceneState): number;
export function glowUV(s: SceneState): { x: number; y: number }; // 原作 uv，原点左上
export interface Fit { scale: number; left: number; top: number }
export function fitStage(viewportW: number, viewportH: number): Fit;
export function clientToStage(clientX: number, clientY: number, fit: Fit): { x: number; y: number };
```

- [ ] **Step 1: 写失败的测试**

```ts
// src/core/layout.test.ts
import { expect, test } from 'vitest';
import { createState } from './state';
import { PPU, cardRect, clientToStage, fitStage, glowUV, hitTest, labelSlots, pillX } from './layout';

const close = (r: object, e: Record<string, number>) => {
  for (const [k, v] of Object.entries(e)) expect((r as Record<string, number>)[k]).toBeCloseTo(v, 2);
};

test('pixels per world unit', () => {
  expect(PPU).toBeCloseTo(223.9231, 3);
});

test('card rectangles at the initial state', () => {
  const s = createState();
  close(cardRect(s, 0), { cx: 177.355, cy: 474.493, halfW: 119.166, halfH: 71.5 });
  close(cardRect(s, 1), { cx: 436.23, cy: 469.722, halfW: 96.287, halfH: 57.772 });
  close(cardRect(s, 4), { cx: 1155.023, cy: 469.722, halfW: 96.287, halfH: 57.772 });
  close(cardRect(s, 5), { cx: 1394.621, cy: 469.722, halfW: 96.287, halfH: 57.772 });
});

test('card rectangles follow selection and scroll', () => {
  const s = createState();
  s.selected = 9; s.selectedF = 9; s.scroll = 5; s.scrollF = 5;
  close(cardRect(s, 9), { cx: 1177.415, cy: 474.493, halfW: 119.166, halfH: 71.5 });
  close(cardRect(s, 5), { cx: 196.632, cy: 469.722, halfW: 96.287, halfH: 57.772 });
});

test('hit testing cards, inputs and empty space', () => {
  const s = createState();
  expect(hitTest(s, 177, 474, 10, 5)).toEqual({ row: 0, index: 0 });
  expect(hitTest(s, 436, 470, 10, 5)).toEqual({ row: 0, index: 1 });
  expect(hitTest(s, 300, 470, 10, 5)).toEqual({ row: -1, index: 0 });
  expect(hitTest(s, 60, 606, 10, 5)).toEqual({ row: 1, index: 0 });
  expect(hitTest(s, 210, 656, 10, 5)).toEqual({ row: 1, index: 0 });
  expect(hitTest(s, 215, 630, 10, 5)).toEqual({ row: -1, index: 0 });
  expect(hitTest(s, 700, 630, 10, 5)).toEqual({ row: 1, index: 4 });
  expect(hitTest(s, 900, 630, 10, 5)).toEqual({ row: -1, index: 0 });
  expect(hitTest(s, 100, 605, 10, 5)).toEqual({ row: -1, index: 0 });
});

test('six label slots at the initial state', () => {
  const slots = labelSlots(createState(), 10);
  expect(slots.map((l) => l.index)).toEqual([-1, 0, 1, 2, 3, 4]);
  expect(slots[0]!.alpha).toBe(0);
  expect(slots[1]!.x).toBeCloseTo(196.632, 2);
  expect(slots[1]!.alpha).toBeCloseTo(1, 6);
  expect(slots[2]!.x).toBeCloseTo(436.23, 2);
  expect(slots[2]!.alpha).toBeCloseTo(0.35, 6);
  expect(slots[5]!.x).toBeCloseTo(1155.023, 2);
});

test('labels dim by half on the inputs row and fade near the stage edges', () => {
  const s = createState();
  s.row = 1;
  expect(labelSlots(s, 10)[1]!.alpha).toBeCloseTo(0.5, 6);
  s.row = 0; s.scrollF = 0.4;
  const first = labelSlots(s, 10)[1]!;
  expect(first.index).toBe(0);
  expect(first.alpha).toBeCloseTo((0.35 + 0.65) * (1 - (2.408 - 2.3) / 0.5), 3);
});

test('pill and glow positions', () => {
  const s = createState();
  expect(pillX(s)).toBe(136);
  s.inputSelF = 4;
  expect(pillX(s)).toBe(776);
  const g = glowUV(createState());
  expect(g.x).toBeCloseTo(0.15362, 4);
  expect(g.y).toBeCloseTo(0.80789, 4);
});

test('stage fit letterboxes and survives degenerate viewports (Review Focus 3)', () => {
  expect(fitStage(1440, 900)).toEqual({ scale: 1.125, left: 0, top: 45 });
  expect(fitStage(1920, 1080)).toEqual({ scale: 1.5, left: 0, top: 0 });
  const tall = fitStage(390, 844);
  expect(tall.scale).toBeCloseTo(0.3047, 4);
  expect(tall.top).toBeCloseTo(312.31, 1);
  expect(fitStage(4000, 720)).toEqual({ scale: 1, left: 1360, top: 0 });
  for (const [w, h] of [[0, 0], [0, 500], [500, 0], [-10, 300]] as const) {
    expect(fitStage(w, h)).toEqual({ scale: 0, left: 0, top: 0 });
  }
});

test('pointer in the letterbox maps outside the stage and hits nothing (Review Focus 4)', () => {
  const fit = fitStage(1440, 900);
  const p = clientToStage(720, 20, fit);
  expect(p.y).toBeLessThan(0);
  expect(hitTest(createState(), p.x, p.y, 10, 5)).toEqual({ row: -1, index: 0 });
  const inside = clientToStage(720, 450, fit);
  expect(inside).toEqual({ x: 640, y: 360 });
  expect(clientToStage(10, 10, { scale: 0, left: 0, top: 0 })).toEqual({ x: -1, y: -1 });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm test src/core/layout.test.ts`
Expected: FAIL，找不到 `./layout`。

- [ ] **Step 3: 实现 `layout.ts`**

公式见 scene-spec 的 cardRect、hitTest、"卡片名标签"、"Inputs 行"、"背景通道"五节。命中卡片时按索引从小到大返回第一个命中的。`fitStage` 在任一边小于等于 0 时返回全 0。

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm test && pnpm lint`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/core && git commit -m "feat: add layout, hit testing and stage fit"
```

---

### Task 6: 控制器、舞台和 DOM 文字层

**Files:**
- Create: `src/core/text.ts`, `src/core/text.test.ts`, `src/app/controller.ts`, `src/app/controller.test.ts`, `src/ui/Stage.tsx`, `src/ui/TextLayer.tsx`, `src/ui/CardLabels.tsx`, `src/ui/InputsRow.tsx`, `src/assets/fonts/*`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: Task 2 到 5 的全部导出。
- Produces:

```ts
// text.ts
export function formatClock(d: Date): string; // "h:mm"，12 小时制，无前导零
export function formatDate(d: Date): string; // "THURSDAY, NOVEMBER 05"
export function counterText(s: SceneState, appCount: number, inputCount: number): string;
export function printText(app: AppEntry): string;
export const HINT_TEXT: string; // "ARROWS MOVE   ·   OK OPENS   ·   BACK GOES UP"

// controller.ts
export interface SceneText { title: string; sub: string; counter: string; print: string }
export class SceneController {
  readonly state: SceneState;
  readonly apps: readonly AppEntry[];
  readonly inputs: readonly string[];
  constructor(opts?: { apps?: readonly AppEntry[]; inputs?: readonly string[]; random?: () => number });
  key(key: Key): boolean; // 返回是否处理了
  pointerMove(stageX: number, stageY: number): void;
  pointerDown(stageX: number, stageY: number): void;
  tick(dt: number): void; // 调用 advance，然后依次调用帧回调
  getText(): SceneText; // 内容不变时返回同一个对象引用
  subscribeText(fn: () => void): () => void; // 文本变化时通知，供 useSyncExternalStore 使用
  onFrame(fn: (s: SceneState) => void): () => void;
}
```

- [ ] **Step 1: 写失败的测试**

```ts
// src/core/text.test.ts
import { expect, test } from 'vitest';
import { APPS } from '../config/content';
import { createState } from './state';
import { HINT_TEXT, counterText, formatClock, formatDate, printText } from './text';

test('clock is 12-hour without a leading zero (Review Focus 5)', () => {
  expect(formatClock(new Date(2026, 10, 5, 0, 5))).toBe('12:05');
  expect(formatClock(new Date(2026, 10, 5, 9, 9))).toBe('9:09');
  expect(formatClock(new Date(2026, 10, 5, 12, 0))).toBe('12:00');
  expect(formatClock(new Date(2026, 10, 5, 13, 7))).toBe('1:07');
  expect(formatClock(new Date(2026, 10, 5, 22, 30))).toBe('10:30');
});

test('date is upper case English with a two-digit day (Review Focus 5)', () => {
  expect(formatDate(new Date(2026, 10, 5))).toBe('THURSDAY, NOVEMBER 05');
  expect(formatDate(new Date(2026, 11, 25))).toBe('FRIDAY, DECEMBER 25');
});

test('counter, print line and hint keep the original spacing', () => {
  const s = createState();
  expect(counterText(s, 10, 5)).toBe('APPS   1 / 10');
  s.row = 1; s.inputSel = 2;
  expect(counterText(s, 10, 5)).toBe('INPUTS   3 / 5');
  expect(printText(APPS[0]!)).toBe('PRINT   VERMILION   ·   CRIMSON');
  expect(HINT_TEXT).toBe('ARROWS MOVE   ·   OK OPENS   ·   BACK GOES UP');
});
```

```ts
// src/app/controller.test.ts
import { expect, test, vi } from 'vitest';
import { SceneController } from './controller';

test('text follows the apps row and the inputs row', () => {
  const c = new SceneController();
  expect(c.getText()).toEqual({
    title: 'Netflix', sub: 'Series and films',
    counter: 'APPS   1 / 10', print: 'PRINT   VERMILION   ·   CRIMSON',
  });
  c.key('right');
  expect(c.getText().title).toBe('YouTube');
  expect(c.getText().print).toBe('PRINT   ORCHARD   ·   TANGERINE');
  c.key('down');
  expect(c.getText()).toEqual({
    title: 'SMARTCAST', sub: 'SMARTCAST',
    counter: 'INPUTS   1 / 5', print: 'PRINT   ORCHARD   ·   TANGERINE',
  });
});

test('getText is referentially stable and subscribers fire only on change', () => {
  const c = new SceneController();
  const fn = vi.fn();
  c.subscribeText(fn);
  const a = c.getText();
  c.key('left');
  expect(c.getText()).toBe(a);
  expect(fn).not.toHaveBeenCalled();
  c.key('right');
  expect(fn).toHaveBeenCalledTimes(1);
  expect(c.getText()).not.toBe(a);
});

test('pointer events go through hit testing; frame listeners run on tick', () => {
  const c = new SceneController({ random: () => 0.5 });
  c.pointerMove(436, 470);
  expect(c.state.selected).toBe(1);
  c.pointerMove(700, 630);
  expect([c.state.row, c.state.inputSel]).toEqual([1, 4]);
  c.pointerMove(-50, -50);
  expect([c.state.row, c.state.inputSel]).toEqual([1, 4]);
  const frame = vi.fn();
  const off = c.onFrame(frame);
  c.tick(1 / 60);
  expect(frame).toHaveBeenCalledWith(c.state);
  off();
  c.tick(1 / 60);
  expect(frame).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm test src/core/text.test.ts src/app/controller.test.ts`
Expected: FAIL，找不到模块。

- [ ] **Step 3: 实现 `text.ts` 和 `controller.ts`**

`formatDate` 用固定的英文星期和月份数组，不依赖浏览器语言。`SceneController` 默认使用 `APPS` 和 `INPUTS`。

- [ ] **Step 4: 运行，确认通过**

Run: `pnpm test`
Expected: PASS。

- [ ] **Step 5: 放入字体**

临时安装 `@fontsource/lora`、`@fontsource/inter`、`@fontsource/jetbrains-mono`，把 latin 子集的 woff2 复制到 `src/assets/fonts/`：Lora 400 和 500，Inter 400 和 500，JetBrains Mono 400。同时复制各自的 OFL 协议文本，然后卸载这三个包。在 `src/styles.css` 里写 `@font-face`，`font-display: block`。

- [ ] **Step 6: 写舞台和文字层组件**

- `Stage.tsx`：监听窗口尺寸，用 `fitStage` 算出 `transform: translate(left, top) scale(scale)`，`transform-origin: 0 0`，内部是固定 1280×720 的容器，依次放 `<canvas>`（Task 8 接入）和文字层。把 `Fit` 通过 ref 提供给事件处理。
- `App.tsx`：创建一个 `SceneController`；`requestAnimationFrame` 循环里用真实时间差调用 `tick`；`window` 上监听 `keydown`，把 `ArrowLeft/Right/Up/Down`、`Enter`、`Escape`、`Backspace` 映射成 `Key`，**只有 `key()` 返回 true 时才 `preventDefault()`**；`pointermove` 和 `pointerdown` 用 `clientToStage` 换算后转给控制器。时钟每秒检查一次，分钟变化时更新。
- `TextLayer.tsx`：用 `useSyncExternalStore(controller.subscribeText, controller.getText)` 取文本。渲染：时钟、日期、右上两行状态（第一行静态 `SMARTCAST   ·   VOL 44` 加绿色圆点）、计数、大标题、副标题、`Press OK to open`、`APPS` 小标签、`INPUTS` 小标签、底部提示。等宽小字一律 `white-space: pre`。
- `CardLabels.tsx`：6 个绝对定位的标签。在 `controller.onFrame` 里用 `labelSlots` 直接写每个标签的 `textContent`、`transform: translateX(...)`、`opacity`，标签以自身中心对齐 `x`。
- `InputsRow.tsx`：5 个方块，`left = 60 + 160*i`，`top = 606`，150×50；第一个方块名字上方有 `CAST` 小标签。选中框在 `onFrame` 里设置中心 `x = pillX(s)`，`opacity = s.row === 1 ? 1 : 0`。
- 焦点在 Inputs 行时需要变暗的静态元素：对比 `.reference/screenshots/base-input-01.png` 和 `settled-app-01.png`，找出变暗的那些，在 `onFrame` 里把它们的 `opacity` 设为 `s.row === 0 ? 1 : 0.45`。
- 排版初值（1280×720 舞台坐标，Task 11 再精调）：左边距 60；时钟 Inter 28px，顶部约 36；日期等宽 10px，约 74；计数约 141；标题 Lora 96px，字顶约 180；副标题 Inter 21px，基线约 301；提示 15px，约 327；`APPS` 标签约 378；卡片名 15px，中心约 567；`INPUTS` 标签约 594；底部提示约 694；右上两行右对齐到 x=1220，约 43 和 62。琥珀色从截图取色。

- [ ] **Step 7: 手动验证**

Run: `pnpm dev`，浏览器打开后：
- 方向键、Enter、Esc、Backspace 的行为符合规格 4.5。
- 标题、副标题、计数、印花行随选中项变化；进入 Inputs 行后印花行不变。
- 卡片名标签跟着滚动，选中的最亮；选中框只在 Inputs 行可见并平滑滑动。
- 把窗口拖成各种尺寸，舞台始终 16:9 居中。
- 开发者工具的网络面板里没有任何外部域名的请求。

Run: `pnpm lint && pnpm test && pnpm build`
Expected: 全部通过。

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: add controller, stage and DOM text layer"
```

---

### Task 7: 截图与对比工具

**Files:**
- Create: `scripts/capture.mjs`, `scripts/compare-page.mjs`
- Modify: `package.json`（scripts 和 `playwright` 开发依赖）, `src/App.tsx`（调试句柄）

**Interfaces:**
- Consumes: `SceneController`（Task 6）。
- Produces:
  - 页面带 `?debug=1` 时挂 `window.__tvmenu = { controller, pause(), resume(), patch(partial: Partial<SceneState>), settled(): boolean, ready: boolean }`。`pause` 停止用真实时间推进；`patch` 把字段写进状态并强制渲染一帧；`settled` 在 `!bgRunning && bgQueue.length === 0` 且三个缓动值离目标都小于 0.001 时为 true。
  - `pnpm capture`：构建、起 `vite preview`、截图到 `compare/replica/`。
  - `pnpm compare`：生成 `compare/index.html`；加 `--inline` 时把所有图转成 JPEG 内嵌，生成单文件 `compare/inline.html`。

- [ ] **Step 1: 安装 Playwright 和 Chromium**

```bash
pnpm add -D playwright && pnpm exec playwright install chromium
```

下载走本机代理，配置见 `.reference/LOCAL-NOTES.md`。

- [ ] **Step 2: 加调试句柄**

只在 URL 带 `debug=1` 时挂载。无头浏览器里截图会卡住渲染循环，所以截图脚本一律用 `settled()` 轮询而不是固定等待。

- [ ] **Step 3: 写 `scripts/capture.mjs`**

视口 1440×900，打开 `http://localhost:4173/Tv-menu/?debug=1`，等 `__tvmenu.ready`。产出：

| 文件 | 做法 |
|---|---|
| `app-01.png` 到 `app-10.png` | 依次按 → 并等 `settled()`，整窗截图 |
| `input-01.png` 到 `input-05.png` | 回到第 1 个应用并等待，按 ↓，依次按 →，只截舞台区域 `{x:0,y:45,width:1440,height:810}` |
| `ok-1.png` | 回到应用行第 1 个，`pause()`，`patch({ sweep: 0.7 })`，截舞台 |
| `transition-mid.png` | `pause()`，`patch({ bgFrom: 0, bgTo: 1, bgT: 0.5, bgRunning: true, bgDir: 1, bgSeed: 0.37 })`，截舞台 |

- [ ] **Step 4: 写 `scripts/compare-page.mjs`**

每组一行：左原站、右复刻版，下方一个叠图视图（复刻版叠在原站上，带透明度滑块和"差值"混合模式开关）。配对关系：`settled-app-NN.png` 对 `app-NN.png`，`base-input-NN.png` 对 `input-NN.png`，`ok-1.png` 对 `ok-1.png`，`trans-240.png` 对 `transition-mid.png`（这一组只比观感）。原站图用相对路径 `../.reference/screenshots/`。`--inline` 模式用 Playwright 打开页面把每张图重编码成 JPEG 质量 80 后内嵌。

- [ ] **Step 5: 验证**

Run: `pnpm capture && pnpm compare`
Expected: `compare/replica/` 下有 17 张图，`compare/index.html` 存在。此时复刻版只有文字层，画面是黑底白字。`git status` 里不出现 `compare/`。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: add screenshot capture and comparison tooling"
```

---

### Task 8: 渲染器骨架与印花纹理

**Files:**
- Create: `src/gl/SceneRenderer.ts`, `src/gl/prints.ts`, `src/gl/webgl.ts`, `src/gl/webgl.test.ts`, `src/gl/shaders/common.glsl`, `src/gl/shaders/fullscreen.vert.glsl`, `src/gl/shaders/print.frag.glsl`, `src/gl/shaders/copy.frag.glsl`
- Modify: `src/App.tsx`, `src/ui/Stage.tsx`

**Interfaces:**
- Consumes: `APPS`、`rgb01`、`SCENE`、`SceneState`。
- Produces:

```ts
// webgl.ts
export function supportsWebGL2(getContext: (id: 'webgl2') => unknown): boolean;

// prints.ts
export function createPrints(renderer: THREE.WebGLRenderer, apps: readonly AppEntry[]): THREE.WebGLRenderTarget[];
// 每张 640×400，MirroredRepeatWrapping，LinearFilter，无 mipmap，无深度缓冲

// SceneRenderer.ts
export class SceneRenderer {
  constructor(canvas: HTMLCanvasElement, apps: readonly AppEntry[]);
  // 没有 resize 方法：绘图缓冲在构造时固定为 stageW×stageH×renderScale（1280×720），与 css 尺寸和 dpr 无关（实施中改动，原有 resize(cssWidth, cssHeight, dpr)）
  render(s: SceneState): void;
  dispose(): void;
  readonly prints: THREE.WebGLRenderTarget[];
}
```

- `common.glsl`：`ph`（哈希）、`pnoise`（值噪声）、`fbm(p, octaves)`。照抄 `.reference/shaders/print.wgsl` 里的同名函数，哈希常数是 `43758.547`。
- `fullscreen.vert.glsl`：覆盖全屏的单个三角形。
- `print.frag.glsl`：移植 `.reference/shaders/print.wgsl` 的 `pattern_mask` 和 `fs_main`。uniform：`uC0..uC3`（vec3）、`uPP`（vec4：kind、seed、scale、ink）、`uRes`（vec2：640, 400）。

- [ ] **Step 1: 写失败的测试**

```ts
// src/gl/webgl.test.ts
import { expect, test } from 'vitest';
import { supportsWebGL2 } from './webgl';

test('reports support only when a context is returned and never throws', () => {
  expect(supportsWebGL2(() => ({}))).toBe(true);
  expect(supportsWebGL2(() => null)).toBe(false);
  expect(supportsWebGL2(() => { throw new Error('blocked'); })).toBe(false);
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm test src/gl/webgl.test.ts`
Expected: FAIL，找不到 `./webgl`。

- [ ] **Step 3: 实现 `webgl.ts`、着色器、`prints.ts`、`SceneRenderer`**

- 着色器用 `RawShaderMaterial`，`glslVersion: THREE.GLSL3`，源码用 Vite 的 `?raw` 导入后与 `common.glsl` 拼接。
- `createPrints` 对每个应用渲染一次全屏三角形到自己的渲染目标，之后不再重画。
- `SceneRenderer` 构造时创建 `WebGLRenderer({ canvas, alpha: false, antialias: false })`（实施中改动，原为 `antialias: true`），关闭色彩管理，生成印花。本任务的 `render` 先只把场景清成黑色。
- URL 带 `debug=prints` 时，`render` 改为把 10 张印花按 5×2 网格画到屏幕上，每张按卡片正面的取景方式采样：原作 uv `u*0.62 + 0.2`。用 `copy.frag.glsl` 实现。
- `App.tsx`：`supportsWebGL2` 为 false 时不创建渲染器，在舞台中央显示 `WebGL2 is not available`。为 true 时创建 `SceneRenderer`，在 `onFrame` 里调用 `render`。绘图缓冲尺寸固定，舞台尺寸或设备像素比变化时不用通知渲染器（实施中改动，原为此时调用 `resize`）。

- [ ] **Step 4: 运行测试**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: PASS。

- [ ] **Step 5: 目视验证印花形状**

Run: `pnpm dev`，打开 `?debug=prints`。逐张对照 `.reference/screenshots/d-cards-row.png`（第 1 到 5 张，1920 宽）和 `settled-app-06.png` 到 `settled-app-10.png` 里对应的卡片：

- 三块色域的轮廓位置一致。例如 Netflix 左上是亮红色块、右上是深色竖条区、底部偏左有一块深色墨渍。
- 图案类型一致：加号、圆点、鳞片、圆点、竖条、加号、方块、鳞片、圆点、竖条。
- 整体没有上下颠倒或左右镜像。

不一致时先检查 y 翻转约定和 `uRes` 的宽高比。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add WebGL renderer skeleton and print textures"
```

---

### Task 9: 背景通道

**Files:**
- Create: `src/gl/background.ts`, `src/gl/shaders/background.frag.glsl`
- Modify: `src/gl/SceneRenderer.ts`

**Interfaces:**
- Consumes: `prints`、`glowUV`、`rgb01`、`SCENE`、`SceneState`。
- Produces:

```ts
export class BackgroundPass {
  constructor(prints: THREE.WebGLRenderTarget[], apps: readonly AppEntry[]);
  resize(bufferW: number, bufferH: number): void; // 内部目标 = max(1, floor(w/4)) × max(1, floor(h/4))，LinearFilter，ClampToEdge
  render(renderer: THREE.WebGLRenderer, s: SceneState): void; // 画进内部目标
  readonly texture: THREE.Texture;
  dispose(): void;
}
```

`background.frag.glsl` 移植 `.reference/shaders/background.wgsl` 的 `blurred` 和 `fs_main`，噪声函数用 `common.glsl`，`fbm3_` 是 3 层。uniform 取值见 scene-spec 的"背景通道"一节：`uTexA = prints[bgFrom]`、`uTexB = prints[bgTo]`、`uTime`、`uT = bgRunning ? bgT : 1`、`uDir`、`uSeed`、`uRes`（四分之一分辨率目标的尺寸）、`uGlowPos = glowUV(s)`、`uGlow = glow × (row === 0 ? 1 : 0.35)`。

- [ ] **Step 1: 实现着色器和 `BackgroundPass`**

- [ ] **Step 2: 接入 `SceneRenderer`**

`render` 里先调 `background.render`，再用 `copy.frag.glsl` 把 `background.texture` 铺满屏幕。`resize` 里同步调 `background.resize`。

- [ ] **Step 3: 验证**

Run: `pnpm lint && pnpm test && pnpm build && pnpm capture && pnpm compare`

打开 `compare/index.html`，对 10 组应用图逐一检查背景：

- 色块的大形状和位置与原站一致。
- 左侧和下半部压暗，四角有暗角。
- 选中卡片位置下方有一团光晕色的光斑，位置跟着选中项走。
- `transition-mid.png` 里新旧两张图沿一条不规则边界分开，边界上有一条亮带。

再手动 `pnpm dev`：切换时擦除方向跟新旧应用的先后一致；快速连按后背景逐个追上；褶皱缓慢流动；进入 Inputs 行后光斑明显变暗。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add background pass with wipe transition"
```

---

### Task 10: 卡片、倒影与颗粒

**Files:**
- Create: `src/gl/cards.ts`, `src/gl/grain.ts`, `src/gl/shaders/card.vert.glsl`, `src/gl/shaders/card.frag.glsl`, `src/gl/shaders/grain.frag.glsl`
- Modify: `src/gl/SceneRenderer.ts`

**Interfaces:**
- Consumes: `prints`、`cardX`、`focus`、`rgb01`、`SCENE`、`SceneState`。
- Produces:

```ts
export class CardsPass {
  constructor(prints: THREE.WebGLRenderTarget[], apps: readonly AppEntry[]);
  render(renderer: THREE.WebGLRenderer, s: SceneState): void; // 直接画到当前目标上，不清屏
  dispose(): void;
}
export class GrainPass {
  render(renderer: THREE.WebGLRenderer, time: number, bufferW: number, bufferH: number): void;
  dispose(): void;
}
```

- 相机：`PerspectiveCamera`，fovY 30°，宽高比 1280/720，near 0.1，far 50，位于 (0,0,6) 看向原点。
- 几何体：`BoxGeometry(1, 0.6, 0.06)`。three 的 uv 是 v 向上，着色器里先换成原作约定 `vec2(uv.x, 1.0 - uv.y)`。
- 着色器移植 `.reference/shaders/card.wgsl`。uniform：`uMvp`、`uModel`、`uGlow`（vec4）、`uParams`（vec4）、`uTex`。每张卡每遍的取值见 scene-spec 的"卡片通道"一节。
- 混合：预乘 alpha，`CustomBlending`，颜色和 alpha 都是 `src = One`、`dst = OneMinusSrcAlpha`。关闭深度测试和深度写入，剔除背面。
- 顺序：按 `|selectedF - i|` 从大到小排序；先画全部倒影，再画全部本体；`|x| >= 3.4` 的跳过。
- 颗粒：移植 `.reference/shaders/grain.wgsl`，全屏三角形，同样的预乘混合，`grain = 0.07`，片元坐标用设备像素。

- [ ] **Step 1: 实现卡片着色器和 `CardsPass`**

- [ ] **Step 2: 实现 `GrainPass`**

- [ ] **Step 3: 接入 `SceneRenderer`**

`render` 顺序：背景铺屏 → `cards.render` → `grain.render`。

- [ ] **Step 4: 验证**

Run: `pnpm lint && pnpm test && pnpm build && pnpm capture && pnpm compare`

打开 `compare/index.html`，用叠图视图逐组检查：

- 每张卡片的位置、大小、倾斜角与原站重合，叠图时轮廓偏差在 3 个屏幕像素以内。
- 选中卡片更大、有光晕色描边，其余略暗并朝中间偏转。
- 卡片下方有压暗的倒影，向下快速消失。
- 选中第 6 到 10 个应用时，左边缘露出半张卡片，位置与原站一致。
- `input-*.png` 里选中卡片仍然较大但描边变暗。
- `ok-1.png` 里选中卡片上有一道斜向白色高光带，位置与原站的 `ok-1.png` 接近。
- 放大看有细小的噪点。

再手动 `pnpm dev`：鼠标移到卡片上会选中它，命中范围与画面上的卡片吻合；按 Enter 高光重扫一次；噪点在闪动。

帧率：`?debug=1` 时在控制台每 5 秒打印一次平均帧耗时。开发机是无头服务器，没有真实显卡，测不出有意义的帧率。把"真实显卡上 1080p 稳定 60fps"记为待用户签收的项目，不要在这里声称已达标。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add cards, reflections and film grain"
```

---

### Task 11: 文字排版精调

**Files:**
- Modify: `src/styles.css`, `src/ui/TextLayer.tsx`, `src/ui/CardLabels.tsx`, `src/ui/InputsRow.tsx`

**Interfaces:**
- Consumes: Task 7 的对比工具。不改变任何导出。

- [ ] **Step 1: 逐元素对齐**

用 `compare/index.html` 的叠图视图和 `.reference/screenshots/` 里 1920×1080 的局部特写（`d-title.png`、`d-bottom.png`、`d-cards-row.png`、`f1-topright-initial.png`、`e4-title-hover-hdmi1.png`），调整每个文字元素的位置、字号、字重、字距、颜色和透明度。

验收标准（1440×900 的叠图下）：

- 每个文字块的左边缘和基线与原站偏差不超过 2 个屏幕像素。
- 大标题的字宽与原站偏差不超过 1%（用最长的 `Prime Video` 和 `SMARTCAST` 检查）。
- 琥珀色、绿色圆点、各级灰度与原站取色一致，每个通道偏差不超过 8。
- 输入源方块的尺寸、圆角、底色、边框，以及选中框的描边和外发光与 `base-input-*.png` 一致。

- [ ] **Step 2: 复核全部对比组**

Run: `pnpm lint && pnpm test && pnpm build && pnpm capture && pnpm compare`
Expected: 17 组里除 `transition-mid` 外，并排看不出明显差别。记下仍然存在的差异，写进 Task 12 的 README "Known differences" 一节。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "style: align typography and inputs row with the original"
```

---

### Task 12: README 与自动部署

**Files:**
- Create: `README.md`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `pnpm lint`、`pnpm test`、`pnpm build`。

- [ ] **Step 1: 写 `README.md`（英文）**

必须包含这些小节，顺序如下：

1. 一句话说明和线上地址 `https://eyeage.github.io/Tv-menu/`。
2. **Credits**：明确写出这是 gmgn.monster 上 "TV Menu" Rive 场景的学习性移植；着色器算法和场景参数移植自原作内嵌在公开 `.riv` 文件里的 WGSL 和脚本；设计归原作者所有；本仓库不包含原作的任何资源文件。
3. **What differs from the original**：文字用 DOM 渲染；时钟实时更新；加上 Task 11 记下的已知差异。
4. **Controls**：键盘和鼠标操作。
5. **Development**：`pnpm install`、`pnpm dev`、`pnpm test`、`pnpm build`。
6. **Changing the content**：只改 `src/config/content.ts`，说明每个字段的含义。
7. **How it works**：四个渲染通道各一两句，链接到 `docs/notes/`。
8. **Fonts**：Lora、Inter、JetBrains Mono，OFL 协议。

- [ ] **Step 2: 写部署工作流**

`.github/workflows/deploy.yml`：`push` 到 `main` 和手动触发；`permissions: { contents: read, pages: write, id-token: write }`；`concurrency` 组 `pages`。步骤：checkout、安装 pnpm、Node 24 加 pnpm 缓存、`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test`、`pnpm build`、上传 `dist` 为 Pages 产物、部署到 Pages。各官方 action 用当时最新的主版本。工作流里不安装 Playwright，也不运行 `capture`。

- [ ] **Step 3: 本地验证并推送**

Run: `pnpm lint && pnpm test && pnpm build && pnpm preview`
Expected: `http://localhost:4173/Tv-menu/` 正常显示和操作。

```bash
git add -A && git commit -m "docs: add README and GitHub Pages deployment" && git push origin main
```

- [ ] **Step 4: 确认线上**

GitHub Pages 需要仓库所有者在网页上启用一次：Settings → Pages → Source 选 GitHub Actions。启用前工作流的部署步骤会失败，这是预期的。启用并重跑后，用无头浏览器打开 `https://eyeage.github.io/Tv-menu/`，确认页面加载、没有 404 资源、按 → 后标题变成 `YouTube`。

开发机上只能验证 Chromium。Safari 和 Firefox 的表现、真实显卡上的帧率，记为待用户签收的项目。

---

### Task 13: 学习笔记

**Files:**
- Create: `docs/notes/01-print.md`, `docs/notes/02-background.md`, `docs/notes/03-cards.md`, `docs/notes/04-grain.md`, `docs/notes/05-navigation.md`
- Modify: `README.md`（"How it works" 的链接）

**Interfaces:**
- Consumes: 已完成的全部源码。

- [ ] **Step 1: 写五篇中文笔记**

每篇的结构相同：这个效果在画面上是什么样；用了什么技术，分步讲；每个参数控制什么，改大改小会怎样；对应的源码文件；一个"自己动手试试"的小实验。各篇要点：

| 文件 | 必须讲清的内容 |
|---|---|
| `01-print.md` | 哈希和值噪声、fbm 叠加、用两个阈值切三块色域、五种图案的距离函数、墨渍和纸纹、种子如何决定形状、为什么只渲染一次 |
| `02-background.md` | 为什么用四分之一分辨率、取景和褶皱扭曲、多抽头模糊、带噪声的方向性擦除、亮带、调色和暗角、光斑位置的计算、先进先出队列 |
| `03-cards.md` | 透视相机和盒体、选中程度这个连续值如何驱动大小前移描边、绕竖轴旋转、倒角和高光扫动、镜像倒影的矩阵、预乘 alpha 和绘制顺序 |
| `04-grain.md` | 每像素哈希、24fps 量化、提亮和压暗如何用一次预乘混合完成 |
| `05-navigation.md` | 状态里有哪些字段、离散目标值和连续缓动值的分离、指数缓动公式和帧率无关性、5 格可见窗口的最小移动规则、命中测试为什么用投影矩形、逐帧 DOM 更新为什么绕开 React |

- [ ] **Step 2: 验证并提交**

Run: `pnpm lint`
Expected: PASS。笔记里引用的每个文件路径和函数名都真实存在。

```bash
git add -A && git commit -m "docs: add study notes for each effect" && git push origin main
```
