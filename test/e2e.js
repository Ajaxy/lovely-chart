/**
 * End-to-end smoke test: serves the demo page (docs/) with the freshly built
 * library (dist/) overlaid, drives it in headless Chrome and asserts that
 * rendering and every interaction work: tooltips, minimap dragging, legend
 * toggling, zoom in/out, pie hover, theme switch and resize redraw.
 *
 * Run via `npm test` (builds first). Requires Google Chrome, or a Playwright
 * chromium (`npx playwright install chromium`) as fallback.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright-core';

// Demo charts rendered by docs/app.js
const EXPECTED_CHARTS = 14;

const ROOT = path.join(import.meta.dirname, '..');
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

const SPANISH_DATE_LOCALE = {
  months: 'ene,feb,mar,abr,may,jun,jul,ago,sep,oct,nov,dic'.split(','),
  weekDays: 'domingo,lunes,martes,miércoles,jueves,viernes,sábado'.split(','),
};

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
  check('all demo charts created', count === EXPECTED_CHARTS, `got ${count}`);

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
  // The last column regresses easily: its hourly data window is clamped at the
  // data edge, so the clicked day is not in the window's middle
  const plot2 = await chart2.locator('.lovely-chart--tooltip').boundingBox();
  const lastColumnFx = (plot2.width - 5) / plot2.width;
  await hoverWiggle(page, plot2, lastColumnFx, 0.6);
  const clickedDay = await chart2.locator('.lovely-chart--tooltip-title').textContent();
  await page.mouse.click(plot2.x + plot2.width * lastColumnFx, plot2.y + plot2.height * 0.6);
  await sleep(2000);

  const zoomOutCtl = chart2.locator('.lovely-chart--header-zoom-out-control');
  const zoomedIn = (await zoomOutCtl.count()) > 0;
  const dayCaption = await caption2();
  check('zoom-in shows the clicked day', zoomedIn && dayCaption.includes(clickedDay),
    `clicked: ${JSON.stringify(clickedDay)}, caption: ${JSON.stringify(dayCaption)}`);

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

  // --- Start-zoomed init (chart 8: shares, opened already as a pie, no morph) ---
  const startZoomed = charts.nth(8);
  await startZoomed.scrollIntoViewIfNeeded();
  const startedZoomed = await startZoomed.evaluate((el) =>
    el.classList.contains('lovely-chart--state-zoomed-in'));
  const startZoomOut = startZoomed.locator('.lovely-chart--header-zoom-out-control');
  const hasZoomOut = (await startZoomOut.count()) > 0;
  check('start-zoomed shares opens already zoomed', startedZoomed && hasZoomOut,
    `zoomed-in: ${startedZoomed}, zoom-out control: ${hasZoomOut}`);

  if (hasZoomOut) {
    await startZoomOut.first().click();
    await sleep(2000);
    const stillZoomed = await startZoomed.evaluate((el) =>
      el.classList.contains('lovely-chart--state-zoomed-in'));
    check('start-zoomed zoom-out returns to overview', !stillZoomed, `still zoomed: ${stillZoomed}`);
  }

  // --- Zoom to shares on an absolute stacked bar chart (chart 10) ---
  // `bars.json` has no `isPercentage`, so this only zooms because of `zoomToShares`.
  const shareBars = charts.nth(10);
  await shareBars.scrollIntoViewIfNeeded();
  const isCircle = await shareBars.evaluate((el) =>
    Boolean(el.querySelector('.lovely-chart--container-type-circle'))
    || el.classList.contains('lovely-chart--container-type-circle'));
  const shareZoomOut = shareBars.locator('.lovely-chart--header-zoom-out-control');
  const shareHasZoomOut = (await shareZoomOut.count()) > 0;
  check('zoomToShares opens shares on a non-percentage chart', isCircle && shareHasZoomOut,
    `circle container: ${isCircle}, zoom-out control: ${shareHasZoomOut}`);

  // A month-granularity chart must not caption its zoom with a single day.
  const monthZoomCaption = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    document.body.appendChild(element);

    const labels = [Date.UTC(2029, 0, 1), Date.UTC(2029, 1, 1), Date.UTC(2029, 2, 1)];
    const chart = new LovelyChart(element, {
      type: 'bar',
      isStacked: true,
      zoomToShares: true,
      circleLabelsAround: 0,
      zoomType: 'donut',
      labels,
      labelType: 'month',
      datasets: [
        { name: 'A', color: '#3497ED', values: [3, 5, 7] },
        { name: 'B', color: '#9ED448', values: [7, 5, 3] },
      ],
      initialZoom: 'last',
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const caption = element.querySelector('.lovely-chart--header-caption').textContent;

    chart.destroy();
    element.remove();
    return caption;
  });
  // A zoomed shares chart must aggregate the selected label only. Line and bar
  // charts extend the range by one label per side to draw edge segments; doing
  // that for a circle silently sums the neighbours into the sectors.
  const singleLabel = charts.nth(11);
  await singleLabel.scrollIntoViewIfNeeded();
  const singlePlot = await singleLabel.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, { ...singlePlot, width: singlePlot.width + 140 }, 0.5, 0.42);
  const singleText = (await singleLabel.locator('.lovely-chart--tooltip-balloon')
    .textContent()).replace(/\s+/g, ' ').trim();
  check('zoomed shares aggregate the selected label only',
    singleText.includes('999') && !singleText.includes('1 999'),
    JSON.stringify(singleText.slice(0, 60)));

  // Dragging the zoomed minimap must step whole labels. Snapping that ignores
  // the half-label offset makes a one-label window straddle two, so the caption
  // flips between a single month and a range on every step.
  const singleCaption = () => singleLabel.locator('.lovely-chart--header-caption').textContent();
  const capZoomed = (await singleCaption()).trim();
  const singleSlider = await singleLabel.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  const labelWidth = (await singleLabel.locator('.lovely-chart--minimap').boundingBox()).width / 5;
  await drag(page, singleSlider.x + singleSlider.width / 2, singleSlider.y + singleSlider.height / 2,
    -labelWidth, 0);
  await sleep(700);
  const capDragged = (await singleCaption()).trim();
  check('zoomed minimap drag steps whole labels',
    capZoomed === 'March 2029'
    && (capDragged === 'February 2029' || capDragged === 'February — March 2029'),
    `${JSON.stringify(capZoomed)} -> ${JSON.stringify(capDragged)}`);

  // The sectors animate towards a new range: their values are what a circle
  // draws, so those are what transition. Without it the pie snaps between
  // aggregations, which is how it behaved when the range applied instantly.
  const donutSignature = () => singleLabel.evaluate((el) => {
    const cv = el.querySelector('canvas');
    const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 997) hash = (hash * 31 + data[i]) % 1000003;
    return hash;
  });
  const dragged = await singleLabel.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  await page.mouse.move(dragged.x + dragged.width / 2, dragged.y + dragged.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragged.x + dragged.width / 2 + labelWidth, dragged.y + dragged.height / 2, { steps: 8 });
  await page.mouse.up();
  const donutFrames = [];
  for (let i = 0; i < 10; i++) {
    donutFrames.push(await donutSignature());
    await sleep(30);
  }
  check('zoomed circle animates towards a new range',
    new Set(donutFrames).size > 3, `${new Set(donutFrames).size} distinct frames`);

  // At the first and last label the half-label margin falls outside the axis.
  // Truncating it there halves the window, which both looks wrong and halves the
  // drag step, since `minimapDelta` is taken from that width.
  const edgeZoom = charts.nth(12);
  await edgeZoom.scrollIntoViewIfNeeded();
  const edgeCaption = (await edgeZoom.locator('.lovely-chart--header-caption').textContent()).trim();
  const edgeMinimap = await edgeZoom.locator('.lovely-chart--minimap').boundingBox();
  const edgeSlider = await edgeZoom.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  // A column chart draws 5 columns, so the selection must sit on the 5th of them
  const column = edgeMinimap.width / 5;
  const startsAt = (edgeSlider.x - edgeMinimap.x) / column;
  const spans = edgeSlider.width / column;
  check('zoom selects exactly its own column',
    edgeCaption === 'May 2029' && Math.abs(startsAt - 4) < 0.12 && spans > 0.75 && spans < 1.05,
    `${JSON.stringify(edgeCaption)}, starts at column ${startsAt.toFixed(2)}, spans ${spans.toFixed(2)}`);

  // --- Discrete dragging follows the pointer, not the slider (chart 13) ---
  // A discrete range moves whole labels, so it must step when the pointer
  // crosses a label boundary. Stepping by how far the slider has travelled
  // instead makes the range change at the same distance whatever part of the
  // slider was grabbed, so a grab near one edge changes it while the pointer is
  // still inside the label it started in.
  const clickZoom = charts.nth(13);
  await clickZoom.scrollIntoViewIfNeeded();

  const dragFromPointer = async (grabFraction) => {
    const plotBox = await clickZoom.locator('.lovely-chart--tooltip').boundingBox();
    await page.mouse.move(plotBox.x + plotBox.width * 0.5, plotBox.y + plotBox.height * 0.6);
    await sleep(250);
    await page.mouse.click(plotBox.x + plotBox.width * 0.5, plotBox.y + plotBox.height * 0.6);
    await sleep(2200);

    const caption = async () => (await clickZoom.locator('.lovely-chart--header-caption').textContent()).trim();
    const canvasBox = await clickZoom.locator('.lovely-chart--minimap canvas').boundingBox();
    const bodyBox = await clickZoom.locator('.lovely-chart--minimap-slider-inner').boundingBox();
    const labelWidth = canvasBox.width / 5;
    const labelAt = (x) => Math.floor((x - canvasBox.x) / labelWidth);
    const startX = bodyBox.x + bodyBox.width * grabFraction;
    const startY = bodyBox.y + bodyBox.height / 2;
    const before = await caption();

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    let labelWhenChanged;
    for (let travelled = 0.05; travelled <= 1.4; travelled += 0.05) {
      const x = startX - labelWidth * travelled;
      await page.mouse.move(x, startY, { steps: 2 });
      await sleep(80);
      if ((await caption()) !== before) {
        labelWhenChanged = labelAt(x);
        break;
      }
    }
    await page.mouse.up();
    await sleep(300);
    const zoomOut = clickZoom.locator('.lovely-chart--header-zoom-out-control');
    if (await zoomOut.count()) {
      await zoomOut.first().click();
      await sleep(2000);
    }

    return { start: labelAt(startX), changed: labelWhenChanged };
  };

  const grabbedNearLeft = await dragFromPointer(0.25);
  const grabbedNearRight = await dragFromPointer(0.75);
  check('discrete drag steps when the pointer crosses a label',
    grabbedNearLeft.changed === grabbedNearLeft.start - 1
    && grabbedNearRight.changed === grabbedNearRight.start - 1,
    `near left: label ${grabbedNearLeft.start} -> changed at ${grabbedNearLeft.changed}; `
    + `near right: label ${grabbedNearRight.start} -> changed at ${grabbedNearRight.changed}`);

  check('month chart captions its zoom by month, not day',
    monthZoomCaption.trim() === 'March 2029', JSON.stringify(monthZoomCaption));

  if (shareHasZoomOut) {
    await shareZoomOut.first().click();
    await sleep(2000);
    const stillCircle = await shareBars.evaluate((el) =>
      el.classList.contains('lovely-chart--state-zoomed-in'));
    check('zoomToShares zoom-out returns to bars', !stillCircle, `still zoomed: ${stillCircle}`);
  }

  // --- Start-zoomed init (chart 9: async onZoom, opened already on the zoomed day) ---
  const startZoomedAsync = charts.nth(9);
  await startZoomedAsync.scrollIntoViewIfNeeded();
  const asyncZoomOut = startZoomedAsync.locator('.lovely-chart--header-zoom-out-control');
  const asyncHasZoomOut = (await asyncZoomOut.count()) > 0;
  const asyncCaption = await startZoomedAsync.locator('.lovely-chart--header-caption').textContent();
  // A zoomed day caption is a single date; the overview caption is a "start — end" range
  check('start-zoomed onZoom opens already zoomed', asyncHasZoomOut && !asyncCaption.includes('—'),
    `zoom-out: ${asyncHasZoomOut}, caption: ${JSON.stringify(asyncCaption)}`);

  if (asyncHasZoomOut) {
    await asyncZoomOut.first().click();
    await sleep(2000);
    const backCaption = await startZoomedAsync.locator('.lovely-chart--header-caption').textContent();
    check('start-zoomed onZoom zoom-out returns to overview', backCaption.includes('—'), JSON.stringify(backCaption));
  }

  // --- Localized captions (own chart, so the demo page stays English) ---
  const localizedCaption = await page.evaluate(async (locale) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const data = await fetch('./data/areas.json').then((response) => response.json());
    const element = document.createElement('div');
    document.body.appendChild(element);

    const chart = new LovelyChart(element, { ...data, initialZoom: 'last', dateLocale: locale });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const caption = element.querySelector('.lovely-chart--header-caption').textContent;

    chart.destroy();
    element.remove();
    return caption;
  }, SPANISH_DATE_LOCALE);
  check('caption honours dateLocale',
    SPANISH_DATE_LOCALE.weekDays.some((day) => localizedCaption.startsWith(day)),
    JSON.stringify(localizedCaption));

  // --- RTL layout (header sides swap, nothing overlaps) ---
  await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
  await sleep(300);
  const rtlHeader = await charts.nth(0).evaluate((el) => {
    const box = (selector) => el.querySelector(selector).getBoundingClientRect();
    const title = box('.lovely-chart--header-title');
    const caption = box('.lovely-chart--header-caption');
    return { titleLeft: title.left, captionRight: caption.right };
  });
  check('rtl header puts the title on the trailing side',
    rtlHeader.titleLeft >= rtlHeader.captionRight,
    `title left: ${Math.round(rtlHeader.titleLeft)}, caption right: ${Math.round(rtlHeader.captionRight)}`);
  await page.evaluate(() => document.documentElement.removeAttribute('dir'));
  await sleep(300);

  // --- Theme switch (MutationObserver -> state update path) ---
  await page.locator('#skin-switcher').click();
  await sleep(800);
  check('theme switch repaints without errors', (await paintedPixels(page, 0)) > 1000);

  // --- Resize (debounced destroy-and-recreate path) ---
  await page.setViewportSize({ width: 700, height: 1200 });
  await sleep(1200);
  const countAfterResize = await page.locator('.lovely-chart--container').count();
  const paintedAfterResize = await paintedPixels(page, 0);
  check('resize redraw keeps all charts alive', countAfterResize === EXPECTED_CHARTS && paintedAfterResize > 1000,
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
