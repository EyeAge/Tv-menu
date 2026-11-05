# TV Menu

A smart-TV home screen drawn with WebGL: ten procedurally printed cards with reflections, a slowly flowing blurred background, film grain, and a row of input sources. It runs in the browser at <https://eyeage.github.io/Tv-menu/>.

## Credits

This is a study port, not an original design. It reproduces the "TV Menu" Rive scene shown at gmgn.monster. The shader algorithms and scene parameters were ported from the WGSL shaders and the script embedded in that site's publicly served `.riv` file. The visual design belongs to its original author, whose name this project does not know. This repository contains none of the original's asset files.

The project has no license. The bundled fonts are the exception; see [Fonts](#fonts).

## What differs from the original

Intentional:

- All text is DOM text laid over the canvas, not drawn inside it, so it is sharper than the original's.
- The clock updates in real time. The original refreshes it only when you navigate.

Measured remaining differences, from pixel comparison at 1440×900 against the original (one pixel means one screen pixel; at the stage scale of 1.125 that is 0.89 stage px):

- Clock digits differ because the time differs. With the same time set, the clock matches exactly at 1440×900 and sits 1 px lower at 1920×1080.
- Several text lines are 1 px off vertically, because Chrome snaps text boxes to whole stage pixels and the original uses fractional positions. At 1440×900, 1 px lower: date line, title top edge, one dimmed card name. 1 px higher: PRINT line, bottom hint, "Press OK to open", SMARTCAST chip name, CAST tag, HDMI-2 and COMP chip names (top edge). At 1920×1080, 1 px lower: clock, title. 1 px higher: "Press OK", chip names, card names.
- Small mono text (9 to 10 px) is slightly dimmer in headless Linux Chromium at 1440×900, although the CSS colors equal the original's fills. The brightest pixels are darker than the original's by up to 2 to 12 levels per channel depending on the line (date −2 to −3, status line −5 to −6, PRINT line −6 to −8, counter −1 to −2, APPS/INPUTS tags −9 to −12, hint −4 to −11, CAST −2 to −4). The tags, PRINT line and hint exceed the 8-level tolerance set for this project. At 1920×1080 the brightest pixels match to the unit.
- The CAST tag uses 0.7 px letter spacing instead of the original's 1.4 px. The original's glyphs are narrower and tighter than JetBrains Mono's, so the tag has the same width (20.0 stage px at 1920×1080, 1 px wider at 1440×900) but each glyph is about 1 px wider.
- The crisp stroke of the Inputs highlight is a little softer at its left and right edges at 1440×900 (at the right edge the brightest pixel is G 207 against 238). Its position matches within 0.2 stage px.
- "Films, series and sport" is 1 px narrower and "TV" (the fifth input's subtitle) is 1 px wider. Glyph edges show sub-pixel antialiasing fringes, because Rive and Skia rasterize differently.
- The WebGL layer renders at a fixed 1280×720 and the browser scales it, without multisampling. This matches how the original renders; it is not a difference in output, but it means the image is not sharper on high-density screens.

Not verified:

- Frame rate on a real GPU. The development machine has none; only software WebGL was available.
- Behaviour in Safari and Firefox. Only headless Chromium was tested.

## Controls

- Apps row: Left and Right move the selection (clamped at both ends). Down moves to the Inputs row. Enter replays the highlight sweep on the selected card.
- Inputs row: Left and Right move the selection (clamped). Up, Escape or Backspace return to the apps row. The selected input is remembered.
- Mouse: hovering a card selects that app, and hovering an input selects that input. Clicking the already selected card replays its highlight sweep. Empty space and the scroll wheel do nothing.

## Development

Requires Node 24 and pnpm 11.

```sh
pnpm install
pnpm dev       # development server
pnpm test      # unit tests
pnpm lint      # eslint and prettier
pnpm build     # type-check and production build into dist/
```

Optional: `pnpm capture` and `pnpm compare` take screenshots with Playwright and build a local side-by-side page against baseline images of the original. The baselines are not distributed, so these commands only work if you have your own baselines; they are not needed for development.

## Changing the content

Content lives only in `src/config/content.ts`. Scene constants (stage size, camera, spacing, timings) are in `src/config/scene.ts`.

`APPS` is a list of `AppEntry`, one per card:

- `name`: card name and the title.
- `sub`: subtitle under the title.
- `print`: name of the print, shown in the PRINT line.
- `palette`: name of the palette, shown after the print name in the PRINT line.
- `glow`: RGB color (0 to 255) of the glow behind the selected card and in the background.
- `colors`: four RGB colors the print uses: base, mid, highlight and pattern.
- `kind`: pattern type: 0 dots, 1 plus signs, 2 scales, 3 stripes, 4 squares.
- `seed`: number that picks a different noise field.
- `scale`: scale of the repeating pattern.
- `ink`: strength of the dark ink blotches, from 0 to 1.

`INPUTS` is a list of input source names shown in the Inputs row.

## How it works

Pure logic is in `src/core/` (state, navigation, per-frame advance, layout, text). `src/app/controller.ts` connects input events to that logic. WebGL is in `src/gl/` with shaders in `src/gl/shaders/`, and the DOM text layer is in `src/ui/`. Each frame draws four things, in this order:

1. **Prints.** Ten textures, one per app, rendered once at 640×400 from layered value noise, thresholded into three color regions with repeating patterns on top. See [docs/notes/01-print.md](docs/notes/01-print.md).
2. **Background.** Drawn at quarter resolution and scaled up bilinearly. It samples the middle of the current print through a drifting distortion, blurs it, and blends between old and new apps with a noise-masked sweep. See [docs/notes/02-background.md](docs/notes/02-background.md).
3. **Cards and reflections.** Ten lit boxes in a perspective view, each textured with a print, plus a darkened mirrored copy below the floor line. See [docs/notes/03-cards.md](docs/notes/03-cards.md).
4. **Film grain.** Per-pixel hash noise that changes at 24 fps. See [docs/notes/04-grain.md](docs/notes/04-grain.md).

Navigation and the animation state machine are described in [docs/notes/05-navigation.md](docs/notes/05-navigation.md).

## Fonts

Lora, Inter and JetBrains Mono, bundled in `src/assets/fonts/`. They are licensed under the SIL Open Font License; the license texts are next to the font files.
