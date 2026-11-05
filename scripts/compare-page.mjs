// Generates compare/index.html (baseline vs replica, with an overlay view).
// With --inline, also writes compare/inline.html with every image embedded as JPEG.
// Usage: pnpm compare [-- --inline]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASELINE_DIR = '.reference/screenshots';
const REPLICA_DIR = 'compare/replica';
const inline = process.argv.includes('--inline');
const pad = (n) => String(n).padStart(2, '0');

const pairs = [];
for (let i = 1; i <= 10; i++)
  pairs.push({ base: `settled-app-${pad(i)}.png`, rep: `app-${pad(i)}.png` });
for (let i = 1; i <= 5; i++)
  pairs.push({ base: `base-input-${pad(i)}.png`, rep: `input-${pad(i)}.png` });
pairs.push({ base: 'ok-1.png', rep: 'ok-1.png' });
pairs.push({
  base: 'trans-240.png',
  rep: 'transition-mid.png',
  note: 'look and feel only, not pixel-aligned',
});

const esc = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const sources = [];
for (const p of pairs) {
  p.basePath = `${BASELINE_DIR}/${p.base}`;
  p.repPath = `${REPLICA_DIR}/${p.rep}`;
  for (const [label, path] of [
    ['baseline', p.basePath],
    ['replica', p.repPath],
  ]) {
    if (existsSync(path)) sources.push(path);
    else console.warn(`warning: missing ${label} image ${path}`);
  }
}

/** Re-encodes PNG files as JPEG (quality 80) using a blank Chromium page. */
async function toJpegDataUrls(paths) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const input = paths.map((p) => [p, readFileSync(p).toString('base64')]);
    const out = await page.evaluate(async (items) => {
      const result = {};
      for (const [path, b64] of items) {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        result[path] = canvas.toDataURL('image/jpeg', 0.8);
      }
      return result;
    }, input);
    return out;
  } finally {
    await browser.close();
  }
}

function render(srcOf) {
  const img = (path, cls, alt) =>
    srcOf(path) === null
      ? `<div class="missing ${cls}">missing: ${esc(path)}</div>`
      : `<img class="${cls}" src="${esc(srcOf(path))}" alt="${esc(alt)}">`;
  const rows = pairs
    .map((p) => {
      const both = srcOf(p.basePath) !== null && srcOf(p.repPath) !== null;
      return `<section class="row">
  <h2>${esc(p.rep)} <small>vs ${esc(p.base)}${p.note ? ` (${esc(p.note)})` : ''}</small></h2>
  <div class="side">
    <figure><figcaption>original</figcaption>${img(p.basePath, 'shot', p.base)}</figure>
    <figure><figcaption>replica</figcaption>${img(p.repPath, 'shot', p.rep)}</figure>
  </div>
  ${
    both
      ? `<div class="overlay">
    <div class="stack">${img(p.basePath, 'layer', p.base)}${img(p.repPath, 'layer top', p.rep)}</div>
    <label>opacity <input type="range" min="0" max="1" step="0.01" value="0.5" class="opacity"></label>
    <label><input type="checkbox" class="diff"> difference</label>
  </div>`
      : '<div class="overlay missing">overlay unavailable (image missing)</div>'
  }
</section>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>TV Menu comparison</title>
<style>
body{margin:0;padding:16px;background:#07090c;color:#ddd;font:14px system-ui,sans-serif}
h2{font-size:16px;margin:0 0 8px}h2 small{color:#888;font-weight:400}
.row{margin-bottom:40px;border-bottom:1px solid #222;padding-bottom:24px}
.side{display:grid;grid-template-columns:1fr 1fr;gap:12px}
figure{margin:0}figcaption{color:#888;margin-bottom:4px}
.shot{width:100%;display:block}
.missing{display:flex;align-items:center;justify-content:center;min-height:200px;border:2px dashed #c33;color:#f66;text-align:center;padding:8px}
.overlay{margin-top:12px;max-width:50%}
.stack{position:relative;line-height:0}.stack .layer{width:100%;display:block}
.stack .top{position:absolute;inset:0;opacity:.5}
.overlay label{display:inline-block;margin:8px 16px 0 0}
</style></head><body>
<h1>TV Menu: original vs replica</h1>
${rows}
<script>
for (const o of document.querySelectorAll('.overlay')) {
  const top = o.querySelector('.top');
  if (!top) continue;
  o.querySelector('.opacity').addEventListener('input', (e) => { top.style.opacity = e.target.value; });
  o.querySelector('.diff').addEventListener('change', (e) => { top.style.mixBlendMode = e.target.checked ? 'difference' : 'normal'; });
}
</script>
</body></html>
`;
}

async function main() {
  mkdirSync('compare', { recursive: true });
  // Relative to compare/, where the page lives.
  writeFileSync(
    'compare/index.html',
    render((p) =>
      existsSync(p) ? p.replace(/^compare\//, '').replace(/^(?!replica)/, '../') : null,
    ),
  );
  console.log('wrote compare/index.html');
  if (inline) {
    const urls = await toJpegDataUrls(sources);
    writeFileSync(
      'compare/inline.html',
      render((p) => urls[p] ?? null),
    );
    const mb = (statSync('compare/inline.html').size / 1024 / 1024).toFixed(2);
    console.log(`wrote compare/inline.html (${mb} MB)`);
  }
}

main().catch((err) => {
  console.error(`compare failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
