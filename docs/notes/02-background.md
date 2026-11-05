# 02 背景：模糊、流动、带亮边的擦除

本文讲的算法移植自原作场景，这里解释的是本仓库对它的实现。

## 画面上是什么

整个舞台后面是一层柔和的色彩。它取自当前选中应用的印花，被放大、模糊、压暗，并且缓慢地"起褶"流动。选中卡片下方有一团该应用颜色的光斑，会跟着选中项滑动。切换应用时，新旧两张图之间有一道带噪声边缘的擦除，边缘上有一条发亮的带。

背景不含任何图片文件：它的输入是 [01 印花](01-print.md) 里那十张纹理。

## 对应的源码

| 文件                                  | 作用                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/gl/shaders/background.frag.glsl` | 背景的片元着色器，所有视觉效果都在这里                                                |
| `src/gl/background.ts`                | `BackgroundPass`：四分之一分辨率的渲染目标；`backgroundParams` 把场景状态变成 uniform |
| `src/core/advance.ts`                 | `advance`：推进过渡进度、管理先进先出队列                                             |
| `src/core/layout.ts`                  | `glowUV`：光斑中心的位置                                                              |
| `src/gl/SceneRenderer.ts`             | 先画背景，再用 `copy.frag.glsl` 把它铺满画布                                          |

## 术语

- **uniform**：CPU 每帧传给着色器的常量，同一次绘制里所有像素读到的值相同。例如 `uTime`、`uT`。
- **双线性放大（bilinear）**：纹理被放大时，每个像素取最近四个纹素的加权平均，所以边缘是平滑的，不是马赛克。
- **smoothstep(a, b, x)**：x 小于 a 返回 0，大于 b 返回 1，中间平滑过渡。

## 第一步：为什么用四分之一分辨率

```ts
// src/gl/background.ts
width: Math.max(1, Math.floor(bufferW / SCENE.bgDownscale)),
```

`bgDownscale` 是 4。绘图缓冲是 1280×720，所以背景目标是 320×180，像素数是全尺寸的 1/16（57,600 对 921,600）。这样做有两个效果：着色器的开销降到十六分之一；另外背景本来就要模糊，低分辨率再被双线性放大，本身就是一层额外的柔化。

画完之后，`SceneRenderer.render` 用 `copy.frag.glsl` 把这张小图铺满整个画布，卡片和颗粒再画在它上面。

## 第二步：取景和褶皱扭曲

着色器里先算每个像素对应印花上的哪个位置：

```glsl
// src/gl/shaders/background.frag.glsl
vec2 fold = vec2(foldX - 0.5, foldY - 0.5) * 0.16;
vec2 uv = ((p * vec2(0.62, 0.62)) + fold) + vec2(0.18, 0.16);
```

`p` 是 0 到 1 的屏幕位置。乘 0.62 表示只取印花中间约六成的区域，再加 `(0.18, 0.16)` 把这个窗口定位在印花上。窗口横向是 0.18 到 0.80，纵向是 0.16 到 0.78。

`fold` 是扭曲量。`foldX`、`foldY` 是两个 3 层 fbm，输入随时间平移：

```glsl
float foldX = fbm((pa * 1.4) + vec2(t * 0.03, 0.0), 3);
float foldY = fbm((pa * 1.4) + vec2(7.0, t * 0.02), 3);
```

`t` 是 `uTime`，即 `s.time`，单位秒。噪声场每秒横向漂 0.03 个单位、纵向漂 0.02 个单位，十秒才漂 0.3，所以肉眼看是缓慢蠕动。3 层 fbm 的取值是 0 到 0.875，减 0.5 再乘 0.16 后，`fold` 的范围是 -0.08 到 0.06，也就是让取景窗口在印花上最多偏移 8% 左右。

## 第三步：七抽头模糊

```glsl
vec3 blurred(sampler2D tex, vec2 uv, float r) {
  vec3 c = sampleAt(tex, uv) * 2.0;
  c = c + sampleAt(tex, uv + vec2(r, 0.0));
  ...
  return c / vec3(8.0);
}
```

一共采样 7 个点：中心一个（权重 2），上下左右各一个，加一对斜向的。7 个采样点，权重合计 2 + 6 = 8，所以最后除以 8。这是最便宜的模糊：不是真正的高斯，但在低分辨率上再被放大，看起来足够柔。

半径 `r` 随过渡进度变化：

```glsl
float moving = 1.0 - abs((2.0 * uT) - 1.0);
float r = 0.012 + (0.014 * moving);
```

`uT` 是过渡进度，0 到 1。`moving` 是个三角波：`uT = 0` 和 `1` 时为 0，`uT = 0.5` 时为 1。平时 `r = 0.012`，擦除进行到一半时 `r = 0.026`。比如 `uT = 0.25`，`moving = 0.5`，`r = 0.019`。也就是说过渡中图像会短暂地更糊。

`sampleAt` 里有一个 `1.0 - uv.y`，是把原作的 uv（原点在左上）转成纹理的 v，见 01 笔记最后一节。

## 第四步：带噪声的方向性擦除

新旧两张图各自模糊一次：旧图读 `uTexA`，新图读 `uTexB`，且新图的取景位置多偏了 `(0.21, 0.07)`，让两张图不是同一块区域。然后算一个遮罩 `m`：

```glsl
float ramp = uDir < 0.0 ? p.x : (1.0 - p.x);
float wipeNoise = fbm((pa * 2.6) + vec2(uSeed * 7.0, uSeed * 3.0), 3);
float m = (ramp * 0.55) + (wipeNoise * 0.9);
float edge = (uT * 1.75) - 0.15;
float keepOld = smoothstep(edge - 0.07, edge + 0.07, m);
vec3 col = mix(newCol, oldCol, keepOld);
```

- `ramp` 是水平方向的斜坡。`uDir` 为 1（往右切到序号更大的应用）时，`ramp = 1 - p.x`，屏幕左侧大、右侧小。
- `wipeNoise` 给边缘加不规则的起伏，`uSeed` 每次过渡随机一次（`advance` 里 `s.bgSeed = random()`），所以每次擦除的边缘形状不同。
- `edge` 是随进度推进的阈值：`uT = 0` 时 -0.15，`uT = 1` 时 1.6。
- `m` 小于 `edge` 的地方显示新图，大于的地方保留旧图。边缘 ±0.07 的范围里平滑过渡。

核对两个端点。`m` 最小 0，最大 `0.55 + 0.9 × 0.875 ≈ 1.34`。`uT = 0` 时 `edge = -0.15`，所有像素的 `m` 都大于 `edge + 0.07`，`keepOld = 1`，全是旧图。`uT = 1` 时 `edge = 1.6`，所有像素的 `m` 都小于 `edge - 0.07`，`keepOld = 0`，全是新图。过渡结束后，新图就是稳定显示的那一张。

方向：`uDir = 1` 时右侧的 `ramp` 小，`m` 小，先被 `edge` 越过，所以新图从右边进来，向左推进。往左切时相反。

## 第五步：边缘上的亮带

```glsl
float band = exp(-(pow(abs((m - edge) * 18.0), 2.0))) * pow(moving, 0.6);
col = col + ((vec3(0.55, 0.5335, 0.50600004) + (uGlow.xyz * 0.6)) * band);
```

`exp(-(x*18)²)` 是一个以 `m = edge` 为中心的钟形曲线，宽度大约 1/18，也就是 0.055。只有紧挨着擦除边缘的像素才亮。亮带颜色是一个暖白 `(0.55, 0.5335, 0.506)` 加上 0.6 倍的光晕色。

乘上 `pow(moving, 0.6)`，让亮带在过渡开始和结束时为 0，中段最亮。

注意 `abs(...)`。原作写的是 `pow(x, 2.0)`，GLSL 里 `pow` 的底数为负时结果未定义（常见是 NaN），所以这里先取绝对值。平方的结果相同，但没有未定义行为。

## 第六步：调色和暗角

```glsl
float lum = dot(col, vec3(0.3, 0.59, 0.11));
col = ((mix(vec3(lum), col, 0.78) * 0.5) * leftDark) * bottomDark;
```

- `lum` 是亮度（灰度值），三个系数是人眼对红绿蓝的敏感度。
- `mix(vec3(lum), col, 0.78)`：保留 78% 的原色，22% 变灰，即部分去饱和。
- `* 0.5`：整体压暗一半。
- `leftDark = 1 - 0.6 * (1 - smoothstep(0, 0.6, p.x))`：最左边是 0.4，到 `p.x = 0.6` 时恢复为 1。
- `bottomDark = 1 - 0.75 * smoothstep(0.5, 1, p.y)`：`p.y` 从 0.5 开始往下渐暗，最底部是 0.25。

一个算例：中心某像素颜色 `(0.8, 0.4, 0.2)`。`lum = 0.24 + 0.236 + 0.022 = 0.498`。去饱和后三个通道各自是 `0.498 × 0.22 + c × 0.78`，得 `(0.734, 0.422, 0.266)`，压暗一半成 `(0.367, 0.211, 0.133)`；若该处 `leftDark` 和 `bottomDark` 都是 1，就是最终色。

最后是暗角：

```glsl
float d = distance(p, vec2(0.5, 0.5)) * 1.2;
col = col * (1.0 - (smoothstep(0.5, 1.2, d) * 0.6));
```

屏幕角上 `distance` 约 0.707，`d ≈ 0.849`，`smoothstep` 约 0.50，乘数 `1 - 0.5 × 0.6 ≈ 0.70`，角落被压暗到 70%。这里 `p` 没有按宽高比修正，所以暗角是和屏幕同比例的椭圆。

## 第七步：光斑位置的计算

光斑是一个以选中卡片为中心的径向光：

```glsl
vec2 dg = vec2((p.x - uGlowPos.x) * aspect, (p.y - uGlowPos.y) * 1.3);
col = col + ((uGlow.xyz * exp((-(dot(dg, dg))) * 10.0)) * 0.55);
```

`dg` 是像素到光斑中心的距离；x 方向乘宽高比 `aspect`（320/180）补偿拉伸，y 方向乘 1.3 让光斑在竖直方向收得更紧。强度 `exp(-d² × 10)`，中心 0.55，往外迅速衰减。比如横向偏离 0.2 个屏宽，`dx = 0.2 × 1.778 = 0.356`，`d² = 0.1264`，`exp(-1.264) ≈ 0.28`，强度约 0.155。

中心位置来自 `glowUV`：

```ts
// src/core/layout.ts
const xSel = cardX(s.selectedF, s.scrollF);
return {
  x: 0.5 + (xSel * PPU) / W,
  y: 0.5 - (SCENE.glowYWorld * PPU) / H,
};
```

`cardX` 用的是缓动后的连续值 `selectedF`，所以光斑平滑滑动，不是跳变。`PPU` 是舞台像素每世界单位，等于 `720 / 2 / 1.607695 ≈ 223.9`。第一张卡选中、滚动位置为 0 时，`xSel = -1.98`，`x = 0.5 + (-1.98 × 223.9) / 1280 ≈ 0.154`；`y` 固定在 `glowYWorld = -0.99` 对应的 `0.5 + 0.99 × 223.9 / 720 ≈ 0.808`，也就是卡片下方。

光晕颜色来自选中应用的 `glow`。焦点在 Inputs 行时，`backgroundParams` 把它乘 `SCENE.rowDimGlow`（0.35）：

```ts
// src/gl/background.ts
const dim = s.row === 0 ? 1 : SCENE.rowDimGlow;
```

这个颜色同时用于光斑和亮带，所以两者一起变暗。

## 先进先出队列

按键速度可以比过渡快。每次选中项变化时，`selectApp` 把新索引推入 `s.bgQueue`。`advance` 每帧最多处理一个背景事件：

```ts
// src/core/advance.ts
if (s.bgRunning) {
  /* 推进 bgT，结束时 bgShown = bgTo */
} else {
  const next = s.bgQueue.shift();
  if (next !== undefined && next !== s.bgShown) {
    /* 开始一次新的过渡 */
  }
}
```

- 一次过渡持续 `bgDuration`（1.1 秒）。以 60 fps 算，每帧 `bgT` 增加 `(1/60) / 1.1 ≈ 0.0152`，约 66 帧走完。
- 过渡进行中，队列里的项都等着。结束后下一帧才取下一项。
- 取出的项如果和已经显示的相同，直接丢掉，什么也不播。

例：连按三次右键，队列是 `[1, 2, 3]`。先播 0 到 1，再播 1 到 2，再播 2 到 3，共约 3.3 秒。连按右、左，队列是 `[1, 0]`：先播 0 到 1，再播 1 到 0。取出的项若恰好等于 `bgShown`，说明画面已经是它了，这一帧什么也不播（`advance.test.ts` 里有这条规则的测试）。

过渡中 `bgShown` 保持不变，直到结束才更新为 `bgTo`。着色器的两张纹理是 `prints[bgFrom]` 和 `prints[bgTo]`；没有过渡时 `backgroundParams` 令 `t = 1`，且 `bgFrom` 等于 `bgTo`。

## 自己动手试试

改 `src/config/scene.ts` 里的 `bgDuration: 1.1`，改成 `bgDuration: 5`。

保存后在页面上按右方向键。擦除变成五秒的慢动作：能清楚地看到新图从右侧推进，沿着不规则的边缘，边缘上那条暖白色亮带在中途最亮、首尾消失。快速连按几次，能看到队列把过渡一个接一个排队播完。

撤销：改回 `1.1`，或者执行 `git checkout src/config/scene.ts`。
