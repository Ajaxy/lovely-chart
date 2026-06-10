/**
 * End-to-end smoke test: serves the demo page (docs/) with the freshly built
 * library (dist/) overlaid, drives it in headless Chrome and asserts that
 * rendering and every interaction work: tooltips, minimap dragging, legend
 * toggling, zoom in/out, pie hover, theme switch and resize redraw.
 *
 * Run via `npm test` (builds first). Requires Google Chrome, or a Playwright
 * chromium (`npx playwright install chromium`) as fallback.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DOCS = path.join(ROOT, 'docs');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
    // dist/ takes precedence so the test exercises the current build,
    // not the published copies committed in docs/
    const file = [path.join(DIST, rel), path.join(DOCS, rel)]
      .find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    if (!file) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    try {
      return await chromium.launch({ headless: true });
    } catch (err) {
      console.error('Could not launch a browser. Install Google Chrome or run: npx playwright install chromium');
      throw err;
    }
  }
}

let failures = 0;

function check(name, condition, details = '') {
  const mark = condition ? 'ok' : 'FAIL';
  console.log(`${mark.padEnd(4)} - ${name}${details ? ` (${details})` : ''}`);
  if (!condition) failures++;
}

function paintedPixels(page, chartIndex) {
  return page.evaluate((i) => {
    const canvas = document.querySelectorAll('.lovely-chart--container')[i].querySelector('canvas');
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let j = 3; j < d.length; j += 4) if (d[j] !== 0) painted++;
    return painted;
  }, chartIndex);
}

// A real hover needs movement over the chart: a single synthetic move event
// can land before the throttled handler picks up the position.
async function hoverWiggle(page, box, fx, fy) {
  await page.mouse.move(box.x + box.width * (fx - 0.05), box.y + box.height * fy, { steps: 5 });
  await sleep(200);
  await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, { steps: 5 });
  await sleep(500);
}

async function drag(page, x, y, dx, dy, steps = 10) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
}

(async () => {
  const server = await startServer();
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });

  const errors = [];
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
  });

  await page.goto(url);
  await page.waitForSelector('.lovely-chart--container', { timeout: 10000 });
  await sleep(1500);

  const charts = page.locator('.lovely-chart--container');

  // --- Rendering ---
  const count = await charts.count();
  check('all demo charts created', count === 7, `got ${count}`);

  for (let i = 0; i < count; i++) {
    const painted = await paintedPixels(page, i);
    const title = await charts.nth(i).locator('.lovely-chart--header-title').first().textContent();
    check(`chart ${i} "${title}" canvas painted`, painted > 1000, `${painted}px`);
  }

  const chart0 = charts.nth(0);
  const caption0 = () => chart0.locator('.lovely-chart--header-caption').textContent();

  // --- Tooltip on hover ---
  const plot0 = await chart0.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, plot0, 0.45, 0.5);
  const balloon0 = chart0.locator('.lovely-chart--tooltip-balloon');
  const tooltipShown = await balloon0.evaluate((el) => el.classList.contains('lovely-chart--state-shown'));
  const tooltipText = (await balloon0.textContent()).trim();
  check('tooltip appears on hover', tooltipShown && tooltipText.length > 0, JSON.stringify(tooltipText.slice(0, 40)));

  // --- Minimap: slider drag pans the range ---
  const capBefore = await caption0();
  const slider = await chart0.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  await drag(page, slider.x + slider.width / 2, slider.y + slider.height / 2, -150, 0);
  await sleep(600);
  const capAfterSlider = await caption0();
  check('minimap slider drag changes range', capAfterSlider !== capBefore, `${capBefore} -> ${capAfterSlider}`);

  // --- Minimap: ear drag resizes the range ---
  const ear = await chart0.locator('.lovely-chart--minimap-slider-handle').first().boundingBox();
  await drag(page, ear.x + ear.width / 2, ear.y + ear.height / 2, -120, 0, 8);
  await sleep(600);
  const capAfterEar = await caption0();
  check('minimap ear drag changes range', capAfterEar !== capAfterSlider, `${capAfterSlider} -> ${capAfterEar}`);

  // --- Legend toggling ---
  const btn = chart0.locator('.lovely-chart--button').first();
  const isChecked = () => btn.evaluate((el) => el.classList.contains('lovely-chart--state-checked'));
  await btn.click();
  await sleep(600);
  const offWorked = !(await isChecked());
  await btn.click();
  await sleep(400);
  check('legend toggle unchecks and re-checks', offWorked && (await isChecked()));

  // Guard: the last checked dataset must refuse to uncheck (with a shake)
  const buttons = chart0.locator('.lovely-chart--button');
  const nBtns = await buttons.count();
  for (let i = 0; i < nBtns; i++) await buttons.nth(i).click();
  await sleep(400);
  const checkedLeft = await chart0.locator('.lovely-chart--button.lovely-chart--state-checked').count();
  const shaken = await chart0.locator('.lovely-chart--state-shake').count();
  check('last checked dataset refuses to uncheck', checkedLeft === 1 && shaken === 1,
    `checked: ${checkedLeft}, shake: ${shaken}`);
  for (let i = 0; i < nBtns; i++) {
    const b = buttons.nth(i);
    if (!(await b.evaluate((el) => el.classList.contains('lovely-chart--state-checked')))) await b.click();
  }
  await sleep(400);

  // --- Zoom in/out (chart 2: zoomable bars) ---
  // Day data in docs/data/zoom_bars only covers the newest dates, so move the
  // viewport to the end of the range before clicking.
  const chart2 = charts.nth(2);
  await chart2.scrollIntoViewIfNeeded();
  const slider2 = await chart2.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  await drag(page, slider2.x + slider2.width / 2, slider2.y + slider2.height / 2, 600, 0, 12);
  await sleep(800);

  const caption2 = () => chart2.locator('.lovely-chart--header-caption').textContent();
  const rangeCaption = await caption2();
  const plot2 = await chart2.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, plot2, 0.75, 0.6);
  await page.mouse.click(plot2.x + plot2.width * 0.75, plot2.y + plot2.height * 0.6);
  await sleep(2000);

  const zoomOutCtl = chart2.locator('.lovely-chart--header-zoom-out-control');
  const zoomedIn = (await zoomOutCtl.count()) > 0;
  const dayCaption = await caption2();
  check('zoom-in shows zoom-out control and day caption', zoomedIn && dayCaption !== rangeCaption,
    JSON.stringify(dayCaption));

  if (zoomedIn) {
    await zoomOutCtl.first().click();
    await sleep(2000);
    // The control element lingers hidden until the next text transition, so
    // the restored caption is the reliable signal that zoom-out completed.
    check('zoom-out restores the range', (await caption2()) === rangeCaption, JSON.stringify(await caption2()));
  }

  // --- Pie/donut hover ---
  const pie = charts.nth(6);
  await pie.scrollIntoViewIfNeeded();
  const piePlot = await pie.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, { ...piePlot, width: piePlot.width + 140 }, 0.5, 0.42);
  const pieBalloon = pie.locator('.lovely-chart--tooltip-balloon');
  const pieShown = await pieBalloon.evaluate((el) => el.classList.contains('lovely-chart--state-shown'));
  const pieText = (await pieBalloon.textContent()).trim();
  check('pie sector hover shows tooltip', pieShown && pieText.length > 0, JSON.stringify(pieText.slice(0, 40)));

  // --- Theme switch (MutationObserver -> state update path) ---
  await page.locator('#skin-switcher').click();
  await sleep(800);
  check('theme switch repaints without errors', (await paintedPixels(page, 0)) > 1000);

  // --- Resize (debounced destroy-and-recreate path) ---
  await page.setViewportSize({ width: 700, height: 1200 });
  await sleep(1200);
  const countAfterResize = await page.locator('.lovely-chart--container').count();
  const paintedAfterResize = await paintedPixels(page, 0);
  check('resize redraw keeps all charts alive', countAfterResize === 7 && paintedAfterResize > 1000,
    `charts: ${countAfterResize}, painted: ${paintedAfterResize}px`);

  // --- Console hygiene ---
  check('no page or console errors', errors.length === 0, errors.join('; ').slice(0, 200));

  await browser.close();
  server.close();

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
