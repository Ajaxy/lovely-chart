/**
 * Renders the preview of each example of the gallery in the day and the night skin, as
 * `docs/examples/thumbnails/<id>-day.webp` and `<id>-night.webp`, and removes the previews of examples that are gone.
 * An example whose preview moves by itself, `isPreviewLive` in `docs/examples/examples.js`, runs live in the gallery
 * and gets none.
 *
 * Run via `npm run thumbnails` (builds first) after a change to an example or to the look of the charts. Renders in the
 * headless shell of the Chromium the locked playwright-core pins, as the e2e test does, and encodes in it as well.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DOCS = path.join(ROOT, 'docs');
const OUT_DIR = path.join(DOCS, 'examples/thumbnails');
// The size of the page the gallery scales a preview down from, and the pixel ratio that keeps the preview sharp at the
// width of a card on a high-density screen
const WIDTH = 640;
const HEIGHT = 500;
const PIXEL_RATIO = 1.5;
const WEBP_QUALITY = 0.8;
// Time for an example to fetch its data and for the transitions of a new chart to end
const SETTLE_TIME = 1500;
const WORKER_COUNT = 4;
const SKINS = [['day', false], ['night', true]];
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.svg': 'image/svg+xml',
};

const { EXAMPLES } = await import(pathToFileURL(path.join(DOCS, 'examples/examples.js')).href);

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const jobs = EXAMPLES
  .filter(({ isPreviewLive }) => !isPreviewLive)
  .flatMap((example) => SKINS.map(([skin, isDark]) => ({ example, skin, isDark })));
const failures = [];

await Promise.all(Array.from({ length: WORKER_COUNT }, async () => {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    try {
      await renderThumbnail(job);
    } catch (err) {
      failures.push(`${job.example.id} (${job.skin}): ${err.message}`);
    }
  }
}));

removeStaleThumbnails();
await browser.close();
server.close();

const files = fs.readdirSync(OUT_DIR);
const totalBytes = files.reduce((sum, file) => sum + fs.statSync(path.join(OUT_DIR, file)).size, 0);
console.log(`${files.length} previews, ${Math.round(totalBytes / 1024)} KB, in ${path.relative(ROOT, OUT_DIR)}`);
if (failures.length) {
  console.error(`Failed:\n  ${failures.join('\n  ')}`);
  process.exitCode = 1;
}

async function renderThumbnail({ example, skin, isDark }) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: PIXEL_RATIO,
    colorScheme: isDark ? 'dark' : 'light',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  try {
    // Any page of the site builds the example's own, as the gallery builds the page of a preview
    await page.goto(`${base}/site/frame.css`);
    const html = await page.evaluate(async ({ id, parts, isDarkSkin }) => {
      document.documentElement.classList.toggle('theme-dark', isDarkSkin);
      const { buildFrameDocument } = await import('/site/frame.js');
      const source = Object.fromEntries(await Promise.all(parts.map(async (part) => {
        const response = await fetch(`/examples/code/${id}.${part}`);
        return [part, await response.text()];
      })));
      return buildFrameDocument(source, { className: 'frame-thumbnail' }).html;
    }, { id: example.id, parts: example.parts || ['js'], isDarkSkin: isDark });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(SETTLE_TIME);
    if (errors.length) {
      throw new Error(errors.join('; '));
    }

    const png = await page.screenshot({ type: 'png' });
    const webp = await encodeWebp(page, png);
    fs.writeFileSync(path.join(OUT_DIR, `${example.id}-${skin}.webp`), webp);
  } finally {
    await context.close();
  }
}

// Chrome encodes WebP from a canvas, so the script needs no image library of its own
async function encodeWebp(page, png) {
  const dataUrl = await page.evaluate(async ({ base64, quality }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas.toDataURL('image/webp', quality);
  }, { base64: png.toString('base64'), quality: WEBP_QUALITY });

  if (!dataUrl.startsWith('data:image/webp;base64,')) {
    throw new Error('The browser encoded no WebP');
  }
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

function removeStaleThumbnails() {
  const expected = new Set(EXAMPLES
    .filter(({ isPreviewLive }) => !isPreviewLive)
    .flatMap(({ id }) => SKINS.map(([skin]) => `${id}-${skin}.webp`)));
  fs.readdirSync(OUT_DIR)
    .filter((file) => !expected.has(file))
    .forEach((file) => fs.rmSync(path.join(OUT_DIR, file)));
}

// Serves the site with the fresh build of the library over the copy `npm run demo` leaves in `docs/`
function startServer() {
  const instance = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const file = [path.join(DIST, urlPath), path.join(DOCS, urlPath)]
      .find((candidate) => candidate.startsWith(ROOT) && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!file) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve) => {
    instance.listen(0, '127.0.0.1', () => resolve(instance));
  });
}
