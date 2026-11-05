// Builds the app, serves it with `vite preview`, drives it in headless Chromium and
// saves screenshots to compare/replica/. Usage: pnpm capture
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4173;
const URL = `http://localhost:${PORT}/Tv-menu/?debug=1`;
const OUT = 'compare/replica';
const STAGE_CLIP = { x: 0, y: 45, width: 1440, height: 810 };
const APP_COUNT = 10;
const INPUT_COUNT = 5;
const pad = (n) => String(n).padStart(2, '0');

function startPreview() {
  const child = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  let exited = false;
  child.on('exit', () => (exited = true));
  const stop = async () => {
    if (exited) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // already gone
    }
    await new Promise((resolve) => {
      child.on('exit', resolve);
      setTimeout(resolve, 3000);
    });
  };
  const ready = async () => {
    for (let i = 0; i < 100; i++) {
      if (exited) throw new Error(`vite preview exited early:\n${log}`);
      try {
        const res = await fetch(URL);
        if (res.ok) return;
      } catch {
        // not listening yet
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`vite preview did not become reachable on port ${PORT}:\n${log}`);
  };
  return { stop, ready };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log('Building...');
  execFileSync('pnpm', ['build'], { stdio: 'inherit' });

  const server = startPreview();
  let browser;
  try {
    await server.ready();
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    page.on('pageerror', (e) => console.error('page error:', e.message));

    const open = async () => {
      await page.goto(URL);
      await page.waitForFunction(() => window.__tvmenu?.ready === true);
    };
    const settle = () =>
      page.waitForFunction(() => window.__tvmenu.settled(), undefined, { timeout: 30000 });
    const press = async (key, times = 1) => {
      for (let i = 0; i < times; i++) await page.keyboard.press(key);
      await settle();
    };
    const shot = async (name, clip) => {
      await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
      console.log(`saved ${OUT}/${name}.png`);
    };

    await open();
    await settle();
    for (let i = 1; i <= APP_COUNT; i++) {
      if (i > 1) await press('ArrowRight');
      await shot(`app-${pad(i)}`);
    }

    await press('ArrowLeft', APP_COUNT - 1);
    await press('ArrowDown');
    for (let i = 1; i <= INPUT_COUNT; i++) {
      if (i > 1) await press('ArrowRight');
      await shot(`input-${pad(i)}`, STAGE_CLIP);
    }

    await press('ArrowUp');
    // The highlight band in the original's ok-1 screenshot sits where sweep is about 0.92.
    await page.evaluate(() => {
      window.__tvmenu.pause();
      window.__tvmenu.patch({ sweep: 0.92 });
    });
    await shot('ok-1', STAGE_CLIP);

    await open();
    await page.evaluate(() => {
      window.__tvmenu.pause();
      window.__tvmenu.patch({
        bgFrom: 0,
        bgTo: 1,
        bgT: 0.5,
        bgRunning: true,
        bgDir: 1,
        bgSeed: 0.37,
        sweep: 2.2,
      });
    });
    await shot('transition-mid', STAGE_CLIP);
  } finally {
    await browser?.close();
    await server.stop();
  }
}

main().catch((err) => {
  console.error(`capture failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
