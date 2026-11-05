# 05 导航：状态、缓动和事件到画面的路径

本文讲的算法移植自原作场景，这里解释的是本仓库对它的实现。

## 画面上是什么

按左右键，选中框和卡片平滑地滑到新位置，而不是跳过去。按下键进入下面的输入源行，上面的卡片整体变暗。鼠标移到卡片上就选中它。卡片行有一个 5 格宽的窗口，选中项走出窗口时，整排卡片才跟着滚。

这些运动不依赖 React 的状态，也不用 CSS 动画。全部由一个普通对象 `SceneState` 加每帧一次的 `advance` 函数驱动，画面（WebGL 和文字）每帧从这个对象里读数据。

## 对应的源码

| 文件                                            | 作用                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `src/core/state.ts`                             | `SceneState` 的字段和初始值                                            |
| `src/core/navigation.ts`                        | `handleKey`、`selectApp`、`hover`、`pointerDown`：按键和指针怎么改状态 |
| `src/core/advance.ts`                           | `advance`：每帧的缓动和背景过渡队列                                    |
| `src/core/layout.ts`                            | `cardRect`、`hitTest`、`labelSlots`、`pillX`：状态到屏幕位置           |
| `src/app/controller.ts`                         | `SceneController`：持有状态，连接事件和 UI                             |
| `src/ui/hooks.ts`、`src/ui/useFrame.ts`         | 帧循环、键盘、指针；`useFrame`                                         |
| `src/ui/CardLabels.tsx`、`src/ui/InputsRow.tsx` | 每帧直接改 DOM 样式的组件                                              |

`src/core/` 和 `src/app/controller.ts` 不引用 React 或 DOM，所以可以单独写单元测试（旁边的 `*.test.ts`）。

## 状态里有哪些字段

```ts
// src/core/state.ts（节选）
row: Row; // 0 应用行，1 输入源行
selected: number;
selectedF: number;
scroll: number;
scrollF: number;
inputSel: number;
inputSelF: number;
sweep: number;
time: number;
(bgShown, bgFrom, bgTo, bgT, bgRunning, bgDir, bgSeed, bgQueue);
```

| 字段                     | 含义                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `row`                    | 焦点在哪一行，是一个两个值的状态                                                                           |
| `selected` / `selectedF` | 选中的应用序号 / 缓动中的连续位置                                                                          |
| `scroll` / `scrollF`     | 5 格窗口最左一格的序号 / 缓动中的连续位置                                                                  |
| `inputSel` / `inputSelF` | 选中的输入源序号 / 缓动中的连续位置                                                                        |
| `sweep`                  | 高光扫动的进度，从 0 线性增长到 `sweepMax`（2.2）                                                          |
| `time`                   | 累计的场景时间，驱动背景流动和颗粒                                                                         |
| `bg*`                    | 背景过渡：当前显示、起点、终点、进度、是否在播放、方向、随机种子、等待队列，见 [02 背景](02-background.md) |

动画状态机由两部分组成：

- 焦点：`row` 在 0（应用行）和 1（输入源行）之间切换。
- 背景过渡：`bgRunning` 为 false（空闲，每帧尝试从队列取一项）或 true（播放中，推进 `bgT`，到 1 时回到空闲）。

## 离散目标值和连续缓动值

每个会动的量都有一对字段，以 `selected` 为例：

- `selected` 是整数，是"目标"。按键立即修改它，文字（标题、计数器）、按键逻辑、背景队列都读它。
- `selectedF` 是浮点数，是"当前位置"。它每帧向 `selected` 靠近一点，位置、缩放、描边等视觉量读它。

为什么要分开？如果只有一个值，要么文字跟着动画一起中途变化（标题变成 0.4 张卡片的名字？），要么动画没法做。分开以后，逻辑立刻到位，画面慢慢追上去。`selectedF` 为 0.4 时，`selected` 已经是 1，标题已经是第二张卡的名字，而第 0 张卡还有 `focus = 0.6` 的选中程度。

## 指数缓动公式

```ts
// src/core/advance.ts
const k = 1 - Math.exp(-SCENE.rateSelect * d);
s.selectedF += (s.selected - s.selectedF) * k;
```

每帧让当前值走完"到目标的剩余距离"的 `k` 倍。`d` 是这一帧的时间（秒），`rateSelect` 是 9。

算一遍，60 fps，`d = 1/60`：

- `k = 1 - exp(-9 / 60) = 1 - exp(-0.15) ≈ 0.1393`。
- `selected` 从 0 变成 1，`selectedF` 从 0 出发：第 1 帧 `0.1393`，第 2 帧 `0.1393 + 0.8607 × 0.1393 ≈ 0.2592`，第 3 帧约 `0.3624`。
- 每帧剩余距离乘 `1 - k = exp(-0.15) ≈ 0.8607`。10 帧后剩 `exp(-1.5) ≈ 22%`，半秒后剩 `exp(-4.5) ≈ 1.1%`。
- 半衰期（剩一半所需时间）是 `ln 2 / 9 ≈ 0.077` 秒，约 4.6 帧。

特点是：开始最快，越接近越慢，不会过冲，也不需要知道总时长。中途改目标也完全没问题，直接朝新目标走。

**帧率无关。** 关键在于 `k` 里带着 `d`。看 30 fps，`d = 1/30`，`k = 1 - exp(-0.3) ≈ 0.2592`。60 fps 下走两帧，剩余比例是 `0.8607² = 0.7408`，已走 `1 - 0.7408 = 0.2592`。和 30 fps 走一帧完全相同。因为 `exp(-a) × exp(-b) = exp(-(a + b))`，分多少帧走都一样。

对比一种常见的写法 `x += (target - x) * 0.1393`（常数系数）：60 fps 下和上面一样，但 30 fps 下每秒只走 30 次，速度就慢了一半。

**步长上限。** `advance` 开头是 `const d = Math.min(dt, SCENE.maxDt)`，`maxDt` 为 0.05。切到别的标签页再回来时，`requestAnimationFrame` 的间隔可能是好几秒。不限制的话，这一帧 `k` 接近 1，状态直接跳到终点，高光扫动和背景过渡也一下子被推到尽头。限制成 0.05 后，一次最多当作 50 毫秒，此时 `k = 1 - exp(-0.45) ≈ 0.3624`。

三种缓动对象用的速率不同：选中项和输入源选中框是 `rateSelect = 9`，卡片行滚动是 `rateScroll = 7`，所以滚动稍慢一点（`k` 在 60 fps 下约 0.1101）。`sweep` 不是指数，而是匀速：`sweep = min(sweepMax, sweep + d × sweepSpeed)`。

## 按键与 5 格可见窗口

`handleKey` 按 `row` 分两套：

| 键                 | 应用行（`row = 0`）                 | 输入源行（`row = 1`）       |
| ------------------ | ----------------------------------- | --------------------------- |
| 左、右             | `selectApp(选中序号 ∓ 1)`，两端钳制 | `inputSel` 加减 1，两端钳制 |
| 下                 | `row = 1`                           | 无效果                      |
| 上、Esc、Backspace | 无效果                              | `row = 0`                   |
| Enter              | `sweep = 0`，重播高光               | 无效果                      |

`handleKey` 的返回值表示这个键有没有被处理，处理了才调用 `preventDefault`（`useKeyboard`）。`inputSel` 在离开输入源行时保留，再进入时仍是原来的。

窗口规则在 `selectApp` 里：

```ts
// src/core/navigation.ts
if (s.selected < s.scroll) s.scroll = s.selected;
else if (s.scroll + SCENE.visibleCards - 1 < s.selected) {
  s.scroll = s.selected - SCENE.visibleCards + 1;
}
```

窗口覆盖序号 `scroll` 到 `scroll + 4` 共 5 格（`visibleCards = 5`）。规则是"最小移动"：选中项在窗口内就不动；超出右边，窗口右移刚好把它放到最右一格；超出左边，左移刚好把它放到最左一格。

十个应用时的例子：

| 操作                | `selected` | `scroll` | 为什么                                  |
| ------------------- | ---------- | -------- | --------------------------------------- |
| 初始                | 0          | 0        |                                         |
| 右移到 4            | 4          | 0        | `0 + 4 < 4` 不成立，窗口不动            |
| 再右移到 5          | 5          | 1        | `0 + 4 < 5`，`scroll = 5 - 5 + 1 = 1`   |
| 左移回到 4          | 4          | 1        | 在窗口 1 到 5 内，不动                  |
| 一路左移到 0        | 0          | 0        | 到 0 时 `0 < 1`，`scroll = 0`           |
| 鼠标直接悬停第 9 张 | 9          | 5        | `scroll = 9 - 5 + 1 = 5`，窗口是 5 到 9 |

`scrollF` 才是用来摆卡片的：`cardX(index, scrollF) = (index - scrollF) × 1.07 - 1.98`。`scroll` 为 0 时第 0 张在 `-1.98`；`scroll` 为 1 时，第 0 张移到 `-3.05`，大部分身子在舞台左边缘之外（舞台半宽约 2.86 个世界单位），只有右侧一小部分露进来，这就是"窗口不在最左时，舞台左边缘露出前一张卡片"。

## 命中测试：为什么用投影矩形

鼠标移到卡片上要选中它。用户指着的是屏幕上看到的那块区域，而卡片的大小和位置随选中程度变化（缩放、前移、透视），所以命中区域也要跟着变，不能用固定的格子。

`cardRect` 把世界坐标映射成舞台像素，用的是和投影相同的系数：

```ts
// src/core/layout.ts
const persp = SCENE.cameraZ / (SCENE.cameraZ - z);
const k = PPU * persp;
return {
  cx: W / 2 + cardX(index, s.scrollF) * k,
  cy: H / 2 - SCENE.cardY * k,
  halfW: scale * SCENE.cardHalfW * k,
  halfH: scale * SCENE.cardHalfH * k,
};
```

一个算例，初始状态（`selectedF = 0`，`scrollF = 0`）。第 0 张 `f = 1`，`scale = 1.02`，`z = 0.25`，`persp = 6 / 5.75 ≈ 1.0435`，`k ≈ 233.7`。矩形：中心 `(177.4, 474.5)`，半宽 `119.2`，半高 `71.5`，所以指针在 `(200, 480)` 命中第 0 张。第 1 张 `f = 0`，`k = 223.9`，中心 `(436.2, 469.7)`，半宽 `96.3`。

`hitTest` 依序检查卡片，先命中的（序号小的）赢，没中就检查输入源方块（`y` 在 `inputTop` 到 `inputBottom`，`x` 在 `inputX0 + inputPitch × i` 起宽 `inputW`），都没中返回 `row: -1`，什么也不发生。

这是一个近似：矩形忽略了绕竖轴的旋转。第 0 张卡的前表面右上角在舞台上的真实位置是 `x ≈ 300`（见 [03 卡片](03-cards.md)），矩形右边缘是 `177.4 + 119.2 = 296.6`，差约 3 像素。对鼠标交互来说无所谓。

鼠标位置要先换算到舞台坐标：舞台被缩放居中放进窗口，`clientToStage` 用 `fitStage` 给出的 `scale` 和偏移把 `clientX, clientY` 变成 1280×720 逻辑坐标。

## 逐帧 DOM 更新为什么绕开 React

一次按键走的路径：

```
keydown → controller.key → handleKey 改 state → refreshText（只有文字变了才通知）
每帧：requestAnimationFrame → controller.tick(dt) → advance 改 state
        → 通知所有 onFrame 监听者：渲染 WebGL、更新标签位置、更新选中框
```

`SceneState` 是一个可变的普通对象，不是 React 的 state。`useFrameLoop` 每帧调用 `controller.tick`，`tick` 里先 `advance`，然后依次调用 `onFrame` 注册的函数。

每帧都在变的东西（卡片名标签的位置和透明度、输入源选中框、应用行标签的整体亮度）由组件直接写样式：

```tsx
// src/ui/CardLabels.tsx
el.style.transform = `translateX(${slot.x}px) translateX(-50%)`;
el.style.opacity = String(slot.alpha);
```

组件通过 `useFrame(controller, update)` 订阅，`update` 里用 `ref` 拿到 DOM 节点直接改。React 的渲染一次都不触发。

如果改成 `setState`，每秒 60 次，每次都要重新执行组件函数、对比虚拟 DOM，只为了更新几个节点的 `transform` 和 `opacity`，白白浪费。而 WebGL 的绘制本来就是命令式的，两边用同一份数据源，写法也一致。

只有偶尔变化的东西才走 React：标题、副标题、计数器、PRINT 行。`controller` 的 `refreshText` 在按键和指针事件后重新算文字，和上次逐字段比较，真有变化才通知，`TextLayer` 用 `useSyncExternalStore(controller.subscribeText, controller.getText)` 订阅。时钟每秒检查一次，字符串变了才 `setValue`。

`controller.realtime` 是个开关：为 false 时帧循环不再用真实时间推进场景。`?debug=1` 时 `src/app/debug.ts` 暴露的 `pause`、`patch` 用它让脚本手动控制，截图对比就靠这个。

## 自己动手试试

改 `src/config/scene.ts` 里的两个值：`rateSelect: 9` 改成 `rateSelect: 1.5`，`rateScroll: 7` 改成 `rateScroll: 1`。

保存后按右键。卡片的放大、描边和滚动变成慢悠悠的滑行，半衰期从 0.077 秒变成 `ln 2 / 1.5 ≈ 0.46` 秒。快速连按几下，能看到状态不会"排队等动画"，每次都直接朝最新的目标走，中途转向也很平滑。同时标题和计数器在按键的瞬间就变了，因为它们读的是离散的 `selected`，不是 `selectedF`。

撤销：改回 `9` 和 `7`，或者执行 `git checkout src/config/scene.ts`。
