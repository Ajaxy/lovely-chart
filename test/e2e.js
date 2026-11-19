/**
 * End-to-end smoke test: serves the demo page (docs/) with the freshly built
 * library (dist/) overlaid, drives it in headless Chrome and asserts that
 * rendering and every interaction work: tooltips, minimap dragging, legend
 * toggling, zoom in/out, pie hover, reference lines, comparison, selection
 * callbacks, the plot-area variables, a late web font, colour schemes, theme
 * switch, resize redraw, and `update()` and `destroy()` mid-interaction.
 *
 * Run via `npm test` (builds first). Requires Google Chrome, or a Playwright
 * chromium (`npx playwright install chromium`) as fallback.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright-core';

import { buildWideFont, WIDE_FONT_FAMILY } from './wideFont.js';

// Demo charts rendered by docs/app.js
const EXPECTED_CHARTS = 16;
const COMPARISON_CHART = 9;
const LIMIT_CHART = 10;
const SPARKLINE_CHART = 11;
const SMOOTH_CHART = 12;
const FORECAST_CHART = 13;
const DAY_PICKER_CHART = 14;
const RTL_CHART = 15;
// The datasets of the smooth demo chart, the last of which starts hidden, and its axis labels in each skin
const SMOOTH_COLORS = ['#E65850', '#F79E39', '#5FB641'];
const SMOOTH_AXIS_FONT_SIZE = 12;
const SMOOTH_AXIS_COLORS = { night: '#7FB8F0', day: '#2373DB' };
// The days of the forecast demo chart, the last of which its band covers
const FORECAST_DAYS = 28;
const FORECAST_WEEK = 7;
const FORECAST_LINE_COLOR = '#3497ED';
// The width of a small phone, which the demo page fits
const PHONE_WIDTH = 375;

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

// A web font the server holds back until `releaseWideFont()`, so it loads after the chart that uses it is built
const WIDE_FONT_PATH = '/wide-font.ttf';
const heldFontResponses = [];

// Series fills of a dashboard's light and dark themes, pale and deep, for the legend label contrast check
const LEGEND_FILLS = {
  'light ink': '#343D47',
  'light ink soft': '#7D8995',
  'light neutral': '#C5CCD3',
  'light amber': '#B07800',
  'light danger soft': '#EBA39E',
  'light caution soft': '#E9B949',
  positive: '#1BB866',
  danger: '#F35B5B',
  caution: '#FFB020',
  accent: '#0191FF',
  'dark ink': '#DFE5EA',
  'dark ink soft': '#8A97A5',
  'dark neutral': '#46525E',
  'dark danger soft': '#8F4A47',
  'dark caution soft': '#8A6A1F',
};
// The middle of the plot, where the lines run clear of the axis labels at either side
const CONSTANT_LINE_BAND = [0.2, 0.8];
// The middle of the plot, where the dot of a single label sits
const SINGLE_LABEL_BAND = [0.45, 0.55];
// The plot of the default 320px canvas runs from under its top padding to over the X-axis band
const PLOT_TOP = 15;
const PLOT_BOTTOM = 290;
// The minimap plots its 40px canvas under a 1px top padding
const MINIMAP_PLOT_TOP = 1;
const MINIMAP_PLOT_BOTTOM = 40;
// The finest Y-axis step, below which a label could only be float noise
const FINEST_Y_STEP = 0.0001;
// A value in the trillions, past which a Y-axis step of a ten-thousandth adds nothing, the `T` its label abbreviates it
// by, and how far the label may round it
const TRILLION_VALUE = 1.234e12;
const TRILLION = 1e12;
const TRILLION_LABEL_TOLERANCE = 0.05;
// How long a page that draws no frame takes to count as frozen
const FREEZE_TIMEOUT_MS = 15_000;
// A sparkline insets its plot from every edge of the canvas
const SPARKLINE_INSET = 2;
// A pan step of the minimap slider, in px, that lands each frame on a window a little further on
const NARROW_PAN_STEP = 4;
// The texts a frame of a panned chart prints, its X-axis and Y-axis labels, the fading ones included
const MAX_PAN_TEXTS_PER_FRAME = 100;
// The least contrast of a white legend label on its fill, below which the dark label takes over, so every label
// reaches it
const MIN_LEGEND_LABEL_CONTRAST = 2;
// The eight colours of the default palette in order, and the pale ones of them, whose legend buttons take dark labels
const DEFAULT_PALETTE = ['#3497ED', '#2373DB', '#9ED448', '#5FB641', '#F5BD25', '#F79E39', '#E65850', '#5D5CDC'];
const DARK_LABEL_DEFAULT_COLORS = ['#9ED448', '#F5BD25'];
// The space between the edge of the canvas and the plot or the Y-axis labels
const GUTTER = 10;
// How far contrast Y-axis labels stand in from their side of the chart
const CONTRAST_LABEL_PADDING = 2;
// The space between an outward Y-label column and the plot
const Y_AXIS_LABEL_GAP = 6;
// How far an edge of the plot-area overlay may stand from the pixels it frames, an antialiased 2px line included
const PLOT_AREA_TOLERANCE = 1.5;
// A host with a padding and a border of its own, which the plot-area properties count from the inside of
const PADDED_HOST_STYLE = 'position: relative; padding: 13px 21px 17px 9px; border: 4px solid #8A97A5';
const PLOT_AREA_PATTERN = /^-?\d+(\.\d+)?px$/;
// A host scaled to three quarters of its width, as a dashboard scaled to fit, and how far its plot-area properties may
// stand from those of the same host at full size
const SCALED_HOST_WIDTH = 600;
const HOST_SCALE = 0.75;
const PLOT_AREA_SCALE_TOLERANCE = 0.01;

// A sloped series that a window of a fifth of its labels pans across, the steps of the pan, the first of which settle
// the window, and how far the pattern may move at one point of the series as the window pans, a smooth line's curves
// measured in chords
const PAN_PHASE_VALUES = [10, 47, 23, 61, 30, 52, 17];
const PAN_PHASE_LABELS = 60;
const PAN_PHASE_STEPS = 40;
const PAN_PHASE_SETTLE_STEPS = 5;
const PHASE_CURVE_CHORDS = 256;
const MAX_PAN_PHASE_SHIFT = 0.1;

// Values of more datasets than a tooltip holds, their order by size unlike their order in the legend
const TOOLTIP_ROW_VALUES = [10, 80, 20, 90, 30, 100, 40, 110, 50, 120, 60, 130, 70];
const TOOLTIP_ROW_COLORS = [
  '#3497ED', '#2373DB', '#9ED448', '#5FB641', '#F5BD25', '#F79E39', '#E65850',
  '#5D5CDC', '#8E44AD', '#16A085', '#C0392B', '#2C3E50', '#D35400',
];
const DEFAULT_COMPARISON_COLOR = '#6B7280';

// The first colour of the default palette, which the first dataset without a colour of its own takes
const DEFAULT_PALETTE_COLOR = '#3497ED';
// An axis text colour of the chart, which a zoom keeps
const ZOOM_AXIS_TEXT_COLOR = '#FF8800';
// The last of the 10 labels of a `mountLinesZoom` overview, in the window the minimap opens on
const LINES_ZOOM_LAST_LABEL_INDEX = 9;
// The labels of the balloon placement probe, the newest of them at the right edge of the plot
const EDGE_LABEL_COUNT = 8;
const HOUR_MS = 3_600_000;
// The fewest pixels of its colour that show a dataset drawn on a canvas
const MIN_DATASET_PIXELS = 100;
// The time from a zoom out of a pie that the transition class holds through, short of the transition's end
const QUICK_ZOOM_OUT_WATCH = 400;
// The time between two zoom clicks, the second before the zoom of the first settles
const DOUBLE_ZOOM_CLICK_GAP = 50;
// The labels of a bar chart that a callback destroys or rebuilds, and the fewer labels it rebuilds it with
const CALLBACK_CHART_LABELS = 30;
const CALLBACK_UPDATE_LABELS = 5;
// The labels of a chart that `update()` or `destroy()` interrupts, and the fewer labels `update()` brings
const INTERRUPTED_LABELS = 30;
const INTERRUPTING_LABELS = 7;
// The colours of the two datasets of an interrupted chart
const INTERRUPTED_COLORS = ['#3497ED', '#F34C44'];
// How far a focused sector of a pie or donut moves out of the circle
const CIRCLE_SHIFT = 10;
// The colour a probe paints over its whole plot canvas, to show what a clip leaves of it
const CLIP_PROBE_COLOR = [255, 0, 255];
// The pixels over which the antialiased edge of a clip or a circle may land
const CLIP_EDGE_TOLERANCE = 2;
// Fractions of the zoom-in and zoom-out transitions of a circle, and those of them that clip it the tightest
const CIRCLE_IN_FRACTIONS = [0, 0.1, 0.25, 0.5, 0.75, 0.85];
const CIRCLE_IN_TIGHT_FRACTIONS = [0.25, 0.5, 0.75];
const CIRCLE_OUT_FRACTIONS = [0, 0.25, 0.5, 0.6, 0.7, 0.9];
const CIRCLE_OUT_TIGHT_FRACTIONS = [0, 0.25, 0.5];

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
    if (urlPath === WIDE_FONT_PATH) {
      heldFontResponses.push(res);
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

function releaseWideFont() {
  const font = buildWideFont();
  heldFontResponses.splice(0).forEach((res) => {
    res.writeHead(200, { 'Content-Type': 'font/ttf' });
    res.end(font);
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

// Counts the pixels of the plot canvas close to `rgb`, thin antialiased strokes included, and averages their height.
// `xBand` limits the count to a horizontal band of the canvas, as fractions of its width, clear of the axis labels.
function findColor(locator, [r, g, b], xBand = [0, 1]) {
  return locator.evaluate((el, [color, [bandStart, bandEnd]]) => {
    const canvas = el.querySelector('canvas');
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    let ySum = 0;
    for (let j = 0; j < d.length; j += 4) {
      const x = (j / 4) % canvas.width;
      const isMatch = d[j + 3] > 100 && Math.abs(d[j] - color[0]) < 24 && Math.abs(d[j + 1] - color[1]) < 24
        && Math.abs(d[j + 2] - color[2]) < 24 && x >= canvas.width * bandStart && x < canvas.width * bandEnd;
      if (isMatch) {
        count++;
        ySum += Math.floor(j / 4 / canvas.width);
      }
    }
    return { count, meanY: count ? ySum / count / (canvas.height / canvas.clientHeight) : undefined };
  }, [[r, g, b], xBand]);
}

// Measures the dashes and gaps of a horizontal blue line on the canvas of an element, the margins and the end dashes
// left out. A column counts as painted where the line covers at least half of it, in the row it covers most, the grid
// line under it tinting the blue a little.
function readBlueLinePattern(locator) {
  return locator.evaluate((el) => {
    const canvas = el.querySelector('canvas');
    const scale = canvas.width / canvas.clientWidth;
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const readBlueAlpha = (x, y) => {
      if (y < 0 || y >= canvas.height) return 0;
      const j = (y * canvas.width + x) * 4;
      return d[j] < 64 && d[j + 1] < 64 && d[j + 2] > 200 ? d[j + 3] : 0;
    };
    let row = 0;
    let rowCount = 0;
    for (let y = 0; y < canvas.height; y++) {
      let rowBlue = 0;
      for (let x = 0; x < canvas.width; x++) if (readBlueAlpha(x, y) > 100) rowBlue++;
      if (rowBlue > rowCount) {
        row = y;
        rowCount = rowBlue;
      }
    }
    const runs = [];
    for (let x = 0; x < canvas.width; x++) {
      const isPainted = Math.max(...[-2, -1, 0, 1, 2].map((dy) => readBlueAlpha(x, row + dy))) >= 128;
      if (runs.length && runs[runs.length - 1].isPainted === isPainted) runs[runs.length - 1].length++;
      else runs.push({ isPainted, length: 1 });
    }
    const inner = runs.slice(2, -2);
    const average = (isPainted) => {
      const lengths = inner.filter((run) => run.isPainted === isPainted).map(({ length }) => length / scale);
      return lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
    };
    return {
      count: inner.filter(({ isPainted }) => isPainted).length,
      dashLength: average(true),
      gapLength: average(false),
    };
  });
}

/**
 * Pans the probe chart's window a minimap pixel a step and follows the point of its patterned stroke nearest the middle
 * of the plot: how far the pattern moved there, in px, the largest shift over the pan, and at how many labels the
 * stroke started meanwhile.
 */
function readPanPhaseShift(page) {
  return page.evaluate(async ({ steps, settleSteps, chords }) => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const context = canvas.getContext('2d');
    const strokes = [];
    let path = [];
    let isRecording = false;
    const { beginPath, moveTo, lineTo, bezierCurveTo, stroke } = CanvasRenderingContext2D.prototype;
    context.beginPath = function (...args) {
      path = [];
      return beginPath.apply(this, args);
    };
    context.moveTo = function (x, y) {
      path.push({ to: [x, y] });
      return moveTo.call(this, x, y);
    };
    context.lineTo = function (x, y) {
      path.push({ to: [x, y] });
      return lineTo.call(this, x, y);
    };
    context.bezierCurveTo = function (x1, y1, x2, y2, x, y) {
      path.push({ controls: [[x1, y1], [x2, y2]], to: [x, y] });
      return bezierCurveTo.call(this, x1, y1, x2, y2, x, y);
    };
    context.stroke = function (...args) {
      const dash = this.getLineDash();
      if (isRecording && dash.length) {
        strokes.push({ offset: this.lineDashOffset, period: dash.reduce((sum, length) => sum + length, 0), path });
      }
      return stroke.apply(this, args);
    };

    const { top, height } = host.querySelector('.lovely-chart--minimap canvas').getBoundingClientRect();
    const slider = host.querySelector('.lovely-chart--minimap-slider-inner');
    const { left, width } = slider.getBoundingClientRect();
    const fire = (target, type, clientX) => {
      const event = new MouseEvent(type, {
        bubbles: true, cancelable: true, buttons: 1, clientX, clientY: top + height / 2,
      });
      (type === 'mousedown' ? target : document).dispatchEvent(event);
    };
    const start = left + width / 2;
    fire(slider, 'mousedown', start);
    for (let step = 1; step <= steps; step++) {
      isRecording = step > settleSteps;
      fire(slider, 'mousemove', start + step);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    fire(slider, 'mouseup', start + steps);
    ['beginPath', 'moveTo', 'lineTo', 'bezierCurveTo', 'stroke'].forEach((name) => delete context[name]);

    // Each vertex of a stroke, with the place of the pattern there and the start of the stroke
    const frames = strokes.map(({ offset, period, path: strokePath }) => {
      let length = 0;
      let previous = strokePath[0].to;
      return strokePath.map(({ controls, to }) => {
        if (controls) {
          let chordStart = previous;
          for (let j = 1; j <= chords; j++) {
            const t = j / chords;
            const u = 1 - t;
            const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
            const pixel = [0, 1].map((axis) => weights[0] * previous[axis] + weights[1] * controls[0][axis]
              + weights[2] * controls[1][axis] + weights[3] * to[axis]);
            length += Math.hypot(pixel[0] - chordStart[0], pixel[1] - chordStart[1]);
            chordStart = pixel;
          }
        } else {
          length += Math.hypot(to[0] - previous[0], to[1] - previous[1]);
        }
        previous = to;
        return { x: to[0], y: to[1], startX: strokePath[0].to[0], phase: (offset + length) % period, period };
      });
    });
    const middle = canvas.clientWidth / 2;
    let point = frames[0].reduce((nearest, vertex) => (
      Math.abs(vertex.x - middle) < Math.abs(nearest.x - middle) ? vertex : nearest
    ));
    const track = frames.map((vertices) => {
      point = vertices
        .filter(({ y }) => Math.abs(y - point.y) < 0.01)
        .reduce((nearest, vertex) => (Math.abs(vertex.x - point.x) < Math.abs(nearest.x - point.x) ? vertex : nearest));
      return point;
    });
    const [{ phase: firstPhase, period }] = track;
    const shifts = track.map(({ phase }) => Math.abs(((phase - firstPhase + period * 1.5) % period) - period / 2));
    return {
      shift: Math.max(...shifts),
      starts: new Set(track.map(({ x, startX }) => Math.round(x - startX))).size,
    };
  }, { steps: PAN_PHASE_STEPS, settleSteps: PAN_PHASE_SETTLE_STEPS, chords: PHASE_CURVE_CHORDS });
}

// Records what the plot canvas of a demo chart draws until `stopCanvasRecording()`: each text, with its font, colour
// and direction, and the count of curves
function startCanvasRecording(chart) {
  return chart.evaluate((el) => {
    const context = el.querySelector('canvas').getContext('2d');
    const recording = { texts: [], curves: 0 };
    window.canvasRecording = { context, recording };
    context.fillText = function (text, ...args) {
      recording.texts.push({ text: String(text), font: this.font, color: this.fillStyle, direction: this.direction });
      return CanvasRenderingContext2D.prototype.fillText.call(this, text, ...args);
    };
    context.bezierCurveTo = function (...args) {
      recording.curves++;
      return CanvasRenderingContext2D.prototype.bezierCurveTo.apply(this, args);
    };
  });
}

function stopCanvasRecording(page) {
  return page.evaluate(() => {
    const { context, recording } = window.canvasRecording;
    delete context.fillText;
    delete context.bezierCurveTo;
    delete window.canvasRecording;
    return recording;
  });
}

// Whether the words of each element's text, in reading order, run from right to left on screen
function readRightToLeftWords(chart, selectors) {
  return chart.evaluate((el, textSelectors) => textSelectors.map((selector) => {
    const range = document.createRange();
    const words = [];
    el.querySelector(selector).childNodes.forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      for (const match of node.data.matchAll(/\S+/g)) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const { left, right } = range.getBoundingClientRect();
        words.push({ word: match[0], left, right });
      }
    });
    return {
      text: words.map(({ word }) => word).join(' '),
      isRightToLeft: words.length > 1 && words.every((word, i) => !i || word.right <= words[i - 1].left + 1),
    };
  }), selectors);
}

// The characters of each negative number of a tooltip balloon in the order they show, left to right
function readNegativeTooltipNumbers(chart) {
  return chart.evaluate((el) => {
    const range = document.createRange();
    const selectors = '.lovely-chart--tooltip-dataset-value, .lovely-chart--tooltip-title-total';
    return [...el.querySelectorAll(selectors)]
      .filter((element) => element.textContent.trim().startsWith('-'))
      .map((element) => {
        const node = element.firstChild;
        const characters = [];
        for (let i = 0; i < node.length; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          if (node.data[i].trim()) characters.push([node.data[i], range.getBoundingClientRect().left]);
        }
        const shown = characters.sort((a, b) => a[1] - b[1]).map(([character]) => character).join('');
        return { text: node.data, shown };
      });
  });
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
/**
 * Mounts a chart for the checks that follow. Fixtures live here rather than on
 * the demo page: they exist to make one failure unmistakable, not to be looked
 * at. `dataUrl` seeds them from a demo dataset, `config` overrides it,
 * `zoomDataSource` attaches the day-drilling `onZoom` the demo page uses, its
 * day data overridden by `zoomConfig`. `hostStyle` styles the element the
 * chart is built in, and `width` sets the chart width in px.
 */
async function mountProbe(page, {
  dataUrl, config = {}, zoomDataSource, zoomConfig = {}, hostStyle = '', width,
} = {}) {
  await page.evaluate(async (spec) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const base = spec.dataUrl ? await fetch(spec.dataUrl).then((response) => response.json()) : {};
    const params = { ...base, ...spec.config };

    if (spec.zoomDataSource) {
      params.onZoom = (timestamp) => {
        const date = new Date(timestamp);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const path = `${date.getFullYear()}-${month < 10 ? '0' : ''}${month}/${day < 10 ? '0' : ''}${day}`;

        return fetch(`${spec.zoomDataSource}/${path}.json`)
          .then((response) => response.json())
          .then((dayData) => ({ ...dayData, ...spec.zoomConfig }));
      };
    }

    const element = document.createElement('div');
    element.id = 'probe';
    element.style.cssText = spec.hostStyle;
    if (spec.width) {
      element.style.width = `${spec.width}px`;
    }
    document.getElementById('container').appendChild(element);
    window.probeChart = new LovelyChart(element, params);
  }, { dataUrl, config, zoomDataSource, zoomConfig, hostStyle, width });
  await sleep(1800);

  return page.locator('#probe .lovely-chart--container');
}

// Collects the numbers the probe chart prints on its canvas, its Y-axis labels among them, with their heights, and
// every text it prints, with its position, alignment, width and the animation frame that drew it
async function recordProbeNumbers(page) {
  await page.evaluate(() => {
    window.probeNumbers = [];
    window.probeTexts = [];
    if (window.isFillTextRecorded) return;
    window.isFillTextRecorded = true;
    window.probeFrame = 0;
    const countFrame = () => {
      window.probeFrame++;
      requestAnimationFrame(countFrame);
    };
    requestAnimationFrame(countFrame);
    const { fillText } = CanvasRenderingContext2D.prototype;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...args) {
      if (this.canvas.closest('#probe')) {
        window.probeTexts.push({
          text: String(text),
          x,
          align: this.textAlign,
          width: this.measureText(text).width,
          frame: window.probeFrame,
          color: typeof this.fillStyle === 'string' ? this.fillStyle : '',
        });
        if (/^-?\d+(\.\d+)?$/.test(String(text))) {
          window.probeNumbers.push({ value: Number(text), y, baseline: this.textBaseline });
        }
      }
      return fillText.call(this, text, x, y, ...args);
    };
  });
}

// The texts the probe chart printed since the last read, and the width of its canvas
function readProbeTexts(page) {
  return page.evaluate(() => {
    const texts = window.probeTexts;
    window.probeTexts = [];
    return { texts, canvasWidth: document.querySelector('#probe canvas').clientWidth };
  });
}

// The texts the last frame among them printed
function getLastFrameTexts({ texts }) {
  const lastFrame = Math.max(...texts.map(({ frame }) => frame));
  return texts.filter(({ frame }) => frame === lastFrame);
}

// Whether a canvas fill style is a hex colour, at any opacity
function isTextColor(fillStyle, hex) {
  return fillStyle === hex.toLowerCase() || fillStyle.startsWith(`rgba(${parseHex(hex).join(', ')}, `);
}

// The main Y-axis labels of an outward column, right-aligned left of the canvas middle, of every frame or the last
function getYLabelColumn({ texts, canvasWidth }, isLastFrame = false) {
  const labels = texts.filter(({ x, align }) => align === 'right' && x < canvasWidth / 2);
  const lastFrame = Math.max(...labels.map(({ frame }) => frame));
  const shownLabels = isLastFrame ? labels.filter(({ frame }) => frame === lastFrame) : labels;
  const ends = [...new Set(shownLabels.map(({ x }) => x))];

  return {
    ends,
    end: ends[0],
    widest: Math.max(0, ...shownLabels.map(({ width }) => width)),
    overflowing: [...new Set(shownLabels.filter(({ x, width }) => x - width < GUTTER).map(({ text }) => text))],
    texts: [...new Set(shownLabels.map(({ text }) => text))],
  };
}

function readProbeNumbers(page) {
  return page.evaluate(() => [...new Set(window.probeNumbers.map(({ value }) => value))].sort((a, b) => a - b));
}

// The labels drawn by the last frame, one per number
function readProbeNumberLabels(page) {
  return page.evaluate(() => Object.values(
    Object.fromEntries(window.probeNumbers.map((label) => [label.value, label])),
  ));
}

// Selects a label of the probe chart and reads its tooltip: the rows, their swatches and colours, and the change
function readProbeTooltip(page, labelIndex) {
  return page.evaluate(async (index) => {
    window.probeChart.selectLabel(index);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const rows = [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset')];
    const swatchedRows = rows.filter((row) => row.querySelector('.lovely-chart--tooltip-swatch'));
    const textColor = getComputedStyle(balloon).color;
    const resolveColor = (variable) => {
      const element = document.createElement('span');
      element.style.color = `var(${variable})`;
      balloon.appendChild(element);
      const color = getComputedStyle(element).color;
      element.remove();
      return color;
    };
    const change = balloon.querySelector('.lovely-chart--tooltip-change');
    // A dashed or dotted swatch is an outline in its colour, a solid one a fill
    const readSwatchColor = (swatch) => getComputedStyle(swatch)[
      swatch.matches('[data-dashed], [data-dotted]') ? 'borderTopColor' : 'backgroundColor'
    ];
    return {
      names: rows.map((row) => row.dataset.name ?? row.firstElementChild.textContent),
      swatched: swatchedRows.map((row) => row.dataset.name),
      swatchColors: swatchedRows.map((row) => readSwatchColor(row.querySelector('.lovely-chart--tooltip-swatch'))),
      dashedSwatches: swatchedRows
        .filter((row) => row.querySelector('.lovely-chart--tooltip-swatch[data-dashed]'))
        .map((row) => row.dataset.name),
      dottedSwatches: swatchedRows
        .filter((row) => row.querySelector('.lovely-chart--tooltip-swatch[data-dotted]'))
        .map((row) => row.dataset.name),
      areValuesInTextColor: rows.every((row) => (
        getComputedStyle(row.querySelector('.lovely-chart--tooltip-dataset-value')).color === textColor
      )),
      titleTotal: balloon.querySelector('.lovely-chart--tooltip-title-total')?.textContent,
      change: {
        text: change?.textContent,
        tone: change?.dataset.tone,
        color: change ? getComputedStyle(change).color : undefined,
        textColor,
        positiveColor: resolveColor('--tooltip-change-positive'),
        negativeColor: resolveColor('--tooltip-change-negative'),
      },
    };
  }, labelIndex);
}

function hexToRgb(hex) {
  return `rgb(${parseHex(hex).join(', ')})`;
}

/**
 * Mounts a line chart of `overview` datasets whose `onZoom` opens a lines view of `zoomed` datasets for the day,
 * each dataset `{ name, color? }`, with the chart's `config` and the day's `zoomConfig`.
 */
async function mountLinesZoom(page, { overview, zoomed, config = {}, zoomConfig = {} }) {
  await page.evaluate(async (spec) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const buildDatasets = (datasets, length) => datasets.map((dataset, i) => ({
      ...dataset,
      values: Array.from({ length }, (_, j) => 10 + ((j + i * 2) % 5) * 10),
    }));

    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeChart = new LovelyChart(element, {
      type: 'line',
      title: 'Probe — Lines zoom colours',
      withMinimap: true,
      labels: Array.from({ length: 10 }, (_, i) => Date.UTC(2026, 10, 1 + i)),
      datasets: buildDatasets(spec.overview, 10),
      onZoom: (day) => Promise.resolve({
        type: 'line',
        labels: Array.from({ length: 24 }, (_, hour) => day + hour * spec.hourMs),
        datasets: buildDatasets(spec.zoomed, 24),
        ...spec.zoomConfig,
      }),
      ...spec.config,
    });
  }, { overview, zoomed, config, zoomConfig, hourMs: HOUR_MS });
  await sleep(1800);

  return page.locator('#probe .lovely-chart--container');
}

function parseHex(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// Counts the pixels of each colour on the plot and the minimap, and reads the outline colours of the legend buttons
async function readDatasetPaint(chart, colors) {
  const minimap = chart.locator('.lovely-chart--minimap');
  const paint = { plot: {}, minimap: {} };
  for (const color of colors) {
    paint.plot[color] = (await findColor(chart, parseHex(color))).count;
    paint.minimap[color] = (await findColor(minimap, parseHex(color))).count;
  }
  paint.legend = await chart.locator('.lovely-chart--button')
    .evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).borderTopColor));
  paint.isMinimapShown = await minimap.evaluate((element) => getComputedStyle(element).display !== 'none');

  return paint;
}

// The plot and the legend show the colours, the minimap too unless the view hides it, and none shows the absent ones
function isPaintedWith(paint, shownColors, absentColors, isMinimapShown = true) {
  const legendColors = shownColors.map(hexToRgb);
  const isMinimapPainted = paint.isMinimapShown === isMinimapShown && (!isMinimapShown || (
    shownColors.every((color) => paint.minimap[color] > MIN_DATASET_PIXELS)
    && absentColors.every((color) => paint.minimap[color] === 0)
  ));
  return isMinimapPainted
    && shownColors.every((color) => paint.plot[color] > MIN_DATASET_PIXELS)
    && absentColors.every((color) => paint.plot[color] === 0)
    && JSON.stringify(paint.legend) === JSON.stringify(legendColors);
}

// Narrows the probe chart's window to the narrowest the minimap selects, then pans it across the data, `stepPx` a frame
async function sweepProbe(page, stepPx = 3) {
  await page.evaluate(async (step) => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const host = document.getElementById('probe');
    const { left, right, top, height } = host.querySelector('.lovely-chart--minimap canvas').getBoundingClientRect();
    const fire = (target, type, clientX) => {
      const event = new MouseEvent(type, {
        bubbles: true, cancelable: true, buttons: type === 'mouseup' ? 0 : 1, clientX, clientY: top + height / 2,
      });
      (type === 'mousedown' ? target : document).dispatchEvent(event);
    };
    const drag = async (target, fromX, toX) => {
      fire(target, 'mousedown', fromX);
      fire(target, 'mousemove', toX);
      fire(target, 'mouseup', toX);
      await wait(500);
    };
    const center = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.left + rect.width / 2;
    };
    const leftEar = host.querySelector('.lovely-chart--minimap-slider-handle');
    const slider = host.querySelector('.lovely-chart--minimap-slider-inner');
    await drag(leftEar, center(leftEar), right + 50);
    await drag(slider, center(slider), center(slider) - (right - left) - 50);
    const start = center(slider);
    fire(slider, 'mousedown', start);
    for (let dx = 0; dx <= right - left; dx += step) {
      fire(slider, 'mousemove', start + dx);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    fire(slider, 'mouseup', start + right - left);
    await wait(600);
  }, stepPx);
}

// Places an element over the probe's plot by the plot-area properties of the probe's element alone
function addPlotAreaOverlay(page) {
  return page.evaluate(() => {
    const overlay = document.createElement('div');
    overlay.id = 'probe-overlay';
    overlay.style.cssText = 'position: absolute; pointer-events: none; '
      + 'left: var(--lovely-chart-plot-area-left); top: var(--lovely-chart-plot-area-top); '
      + 'width: var(--lovely-chart-plot-area-width); height: var(--lovely-chart-plot-area-height)';
    document.getElementById('probe').appendChild(overlay);
  });
}

// The probe's overlay, the values of its plot-area properties and the box of the canvas pixels of each colour, or of
// every painted pixel for `'any'`, all in px from the top left of the canvas
function readPlotAreaFit(page, colors) {
  return page.evaluate((hexes) => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const canvasBox = canvas.getBoundingClientRect();
    const overlayBox = document.getElementById('probe-overlay').getBoundingClientRect();
    const scale = canvas.width / canvas.clientWidth;
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const boxes = hexes.map((hex) => {
      const rgb = hex === 'any' ? undefined : [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity, meanY: 0, count: 0 };
      for (let j = 0; j < data.length; j += 4) {
        const isMatch = data[j + 3] > 100 && (!rgb || rgb.every((channel, k) => Math.abs(data[j + k] - channel) < 24));
        if (!isMatch) continue;
        const x = (j / 4) % canvas.width / scale;
        const y = Math.floor(j / 4 / canvas.width) / scale;
        box.left = Math.min(box.left, x);
        box.top = Math.min(box.top, y);
        box.right = Math.max(box.right, x + 1 / scale);
        box.bottom = Math.max(box.bottom, y + 1 / scale);
        box.meanY += y + 0.5 / scale;
        box.count++;
      }
      box.meanY /= box.count;
      return box;
    });
    return {
      overlay: {
        left: overlayBox.left - canvasBox.left,
        top: overlayBox.top - canvasBox.top,
        right: overlayBox.right - canvasBox.left,
        bottom: overlayBox.bottom - canvasBox.top,
      },
      values: ['left', 'top', 'width', 'height']
        .map((key) => host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)),
      boxes,
    };
  }, colors);
}

// Whether each of the `sides` of the overlay stands within the tolerance of the same side of the box
function isFramedBy(overlay, box, sides = ['left', 'top', 'right', 'bottom']) {
  return box.count > 0 && sides.every((side) => Math.abs(overlay[side] - box[side]) <= PLOT_AREA_TOLERANCE);
}

function formatBox({ left, top, right, bottom }) {
  return [left, top, right, bottom].map((value) => value.toFixed(1)).join(' ');
}

// The left edge of the plot area the probe's element carries, in px from the left of the canvas
function readPlotAreaLeft(page) {
  return page.evaluate(() => {
    const host = document.getElementById('probe');
    const canvas = host.querySelector('.lovely-chart--container > canvas');
    const canvasLeft = canvas.getBoundingClientRect().left - host.getBoundingClientRect().left - host.clientLeft;
    return parseFloat(host.style.getPropertyValue('--lovely-chart-plot-area-left')) - canvasLeft;
  });
}

async function unmountProbe(page) {
  await page.evaluate(() => {
    window.probeChart.destroy();
    document.getElementById('probe').remove();
  });
  await sleep(200);
}

// Reads the dataset colour of each legend button, as its `lovely-chart--color-*` class names it, the contrast of its
// label on its fill, the contrast a white label would have there and whether the label is white
function readLegendLabels(chart) {
  return chart.evaluate((el) => {
    const parseRgb = (value) => value.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const getLuminance = (rgb) => rgb
      .map((channel) => channel / 255)
      .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, i) => sum + [0.2126, 0.7152, 0.0722][i] * value, 0);
    return Array.from(el.querySelectorAll('.lovely-chart--button')).map((button) => {
      const fill = getLuminance(parseRgb(getComputedStyle(button).backgroundColor));
      const label = getLuminance(parseRgb(getComputedStyle(button.querySelector('.lovely-chart--button-label')).color));
      const contrast = (Math.max(fill, label) + 0.05) / (Math.min(fill, label) + 0.05);
      const whiteContrast = 1.05 / (fill + 0.05);
      return {
        name: button.textContent,
        color: `#${button.className.match(/lovely-chart--color-(\w+)/)[1]}`,
        contrast: Math.round(contrast * 100) / 100,
        whiteContrast: Math.round(whiteContrast * 100) / 100,
        isLabelWhite: label > 0.99,
      };
    });
  });
}

/**
 * Mounts a zoomable stacked bar chart of `INTERRUPTED_LABELS` labels, with a minimap and callbacks that log what they
 * report, and runs `update()` to `INTERRUPTING_LABELS` labels or `destroy()` in the task that leaves it mid-interaction:
 * a legend toggle animating, a legend button pressed twice towards a long press, a minimap drag and a pointer move whose
 * frame is pending. `update()` is followed in that task by a click on the new chart, and `destroy()` follows an
 * orientation change, whose redraw is pending. The drag then carries on and ends
 * after the long press would have fired. Reads the callbacks, the errors, the `<html>` classes right after the call,
 * the caption before and after the drag carries on and the frames and timers that fired after the call, when the page
 * counts them.
 */
function interruptProbe(page, action) {
  return page.evaluate(async ({ action, labels, newLabels, colors }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const wait = (ms) => new Promise((resolve) => (window.realSetTimeout ?? window.setTimeout)(resolve, ms));
    const log = [];
    const errors = [];
    const onError = (e) => errors.push(e.message);
    window.addEventListener('error', onError);
    const buildParams = (length) => ({
      type: 'bar',
      title: 'Probe — Interrupted',
      isStacked: true,
      zoomToShares: true,
      withMinimap: true,
      labels: Array.from({ length }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: colors.map((color, i) => ({
        name: `Dataset ${i}`, color, values: Array.from({ length }, (_, j) => 10 + ((i + j) % 4) * 10),
      })),
      onSelectedIndexChange: (index) => log.push(`select ${index}`),
      onHiddenSeriesChange: (names) => log.push(`hidden ${names}`),
      onZoomChange: (value) => log.push(`zoom ${value}`),
    });

    const element = document.createElement('div');
    element.id = 'probe';
    document.body.appendChild(element);
    window.probeChart = new LovelyChart(element, buildParams(labels));
    await wait(800);

    const fire = (target, type, x, y) => {
      const buttons = type === 'mouseup' || type === 'click' ? 0 : 1;
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, buttons, clientX: x, clientY: y }));
    };
    const center = (target) => {
      const { left, top, width, height } = target.getBoundingClientRect();
      return [left + width / 2, top + height / 2];
    };
    const [legendButton, longPressButton] = element.querySelectorAll('.lovely-chart--button');
    const slider = element.querySelector('.lovely-chart--minimap-slider-inner');
    const [sliderX, sliderY] = center(slider);
    const plot = element.querySelector('.lovely-chart--tooltip');
    const plotBox = plot.getBoundingClientRect();
    legendButton.click();
    await wait(50);
    fire(longPressButton, 'mousedown', ...center(longPressButton));
    fire(longPressButton, 'mousedown', ...center(longPressButton));
    fire(slider, 'mousedown', sliderX, sliderY);
    fire(document, 'mousemove', sliderX - 20, sliderY);
    fire(plot, 'mousemove', plotBox.right - 10, plotBox.top + plotBox.height / 2);
    log.length = 0;
    window.lateCallbacks = 0;
    if (action === 'update') {
      window.probeChart.update(buildParams(newLabels));
      fire(element.querySelector('.lovely-chart--tooltip'), 'click', ...center(plot));
    } else {
      window.dispatchEvent(new Event('orientationchange'));
      window.probeChart.destroy();
    }
    window.isCountingLateCallbacks = true;
    const htmlClass = document.documentElement.className;

    const readCaption = () => element.querySelector('.lovely-chart--header-caption')?.textContent;
    await wait(300);
    const captionBefore = readCaption();
    fire(document, 'mousemove', sliderX - 80, sliderY);
    await wait(700);
    const captionAfter = readCaption();
    fire(document, 'mouseup', sliderX - 80, sliderY);
    window.isCountingLateCallbacks = false;
    window.removeEventListener('error', onError);

    return { log, errors, htmlClass, captionBefore, captionAfter, lateCallbacks: window.lateCallbacks };
  }, { action, labels: INTERRUPTED_LABELS, newLabels: INTERRUPTING_LABELS, colors: INTERRUPTED_COLORS });
}

// Counts the frame and timer callbacks that fire while `window.isCountingLateCallbacks` is set
function countLateCallbacks(page) {
  return page.evaluate(() => {
    window.realSetTimeout = window.setTimeout.bind(window);
    ['setTimeout', 'setInterval', 'requestAnimationFrame'].forEach((name) => {
      const schedule = window[name].bind(window);
      window[name] = (callback, ...args) => schedule((...callbackArgs) => {
        if (window.isCountingLateCallbacks) window.lateCallbacks++;
        callback(...callbackArgs);
      }, ...args);
    });
  });
}

// Paints the whole plot canvas of the probe chart in `CLIP_PROBE_COLOR`, and returns the center and the radius, in CSS
// px, of the circle it drew before
function paintOverProbeCircle(page) {
  return page.evaluate((color) => {
    const canvas = document.querySelector('#probe .lovely-chart--container > canvas');
    const context = canvas.getContext('2d');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / canvas.clientWidth;
    let left = Infinity;
    let right = -1;
    let top = Infinity;
    let bottom = -1;
    for (let j = 3; j < data.length; j += 4) {
      if (data[j] > 128) {
        const x = (j - 3) / 4 % canvas.width;
        const y = Math.floor((j - 3) / 4 / canvas.width);
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = `rgb(${color.join(', ')})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    return {
      center: [(left + right + 1) / 2 / scale, (top + bottom + 1) / 2 / scale],
      radius: (right - left + 1) / 2 / scale,
    };
  }, CLIP_PROBE_COLOR);
}

// Replays the zoom-in or the zoom-out transition of the zoomed probe circle, painted over, and reads at each fraction
// of it how far the plot canvas shows from the circle center along its row and its column, on screen
async function measureCircleTransition(page, { isOut, fractions, box, center }) {
  await page.evaluate((shouldZoomOut) => {
    const container = document.querySelector('#probe .lovely-chart--container');
    container.classList.remove('lovely-chart--state-animating');
    if (shouldZoomOut) {
      container.classList.remove('lovely-chart--state-zoomed-in');
    }
    container.getBoundingClientRect();
    container.classList.add('lovely-chart--state-animating');
  }, isOut);

  const reaches = [];
  for (const fraction of fractions) {
    await page.evaluate((at) => {
      document.querySelector('#probe .lovely-chart--container > canvas').getAnimations().forEach((animation) => {
        animation.pause();
        animation.currentTime = animation.effect.getTiming().duration * at;
      });
    }, fraction);
    const screenshot = await page.screenshot({ clip: box });
    reaches.push(await page.evaluate(async ({ source, origin, color, at }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${source}`;
      await image.decode();
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const { data, width, height } = context.getImageData(0, 0, image.width, image.height);
      const [cx, cy] = origin;
      const [x0, y0] = origin.map(Math.floor);
      const isShown = (x, y) => {
        const j = (y * width + x) * 4;
        return x >= 0 && x < width && y >= 0 && y < height
          && color.every((channel, k) => Math.abs(data[j + k] - channel) < 60);
      };
      const countShown = (dx, dy) => {
        let count = 0;
        while (isShown(x0 + dx * (count + 1), y0 + dy * (count + 1))) count++;
        return count;
      };
      // From the center to the outer side of the last pixel shown each way
      const distances = [
        cx - x0 + countShown(-1, 0),
        x0 + 1 + countShown(1, 0) - cx,
        cy - y0 + countShown(0, -1),
        y0 + 1 + countShown(0, 1) - cy,
      ];
      return { fraction: at, shortest: Math.min(...distances), longest: Math.max(...distances) };
    }, { source: screenshot.toString('base64'), origin: center, color: CLIP_PROBE_COLOR, at: fraction }));
  }

  return reaches;
}

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

  // --- Start-zoomed init: shares, opened already as a pie, no morph ---
  const startZoomed = await mountProbe(page, {
    dataUrl: './data/areas.json',
    config: { title: 'Probe — Start Zoomed Shares', initialZoom: 'last' },
  });
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
  await unmountProbe(page);

  // --- Zoom to shares on an absolute stacked bar chart ---
  // `bars.json` has no `isPercentage`, so this only zooms because of `zoomToShares`.
  const shareBars = await mountProbe(page, {
    dataUrl: './data/bars.json',
    config: {
      title: 'Probe — Zoom to Shares',
      zoomToShares: true,
      circleLabelsAround: 0,
      zoomType: 'donut',
      initialZoom: 'last',
    },
  });
  await shareBars.scrollIntoViewIfNeeded();
  const isCircle = await shareBars.evaluate((el) =>
    Boolean(el.querySelector('.lovely-chart--container-type-circle'))
    || el.classList.contains('lovely-chart--container-type-circle'));
  const shareZoomOut = shareBars.locator('.lovely-chart--header-zoom-out-control');
  const shareHasZoomOut = (await shareZoomOut.count()) > 0;
  check('zoomToShares opens shares on a non-percentage chart', isCircle && shareHasZoomOut,
    `circle container: ${isCircle}, zoom-out control: ${shareHasZoomOut}`);

  if (shareHasZoomOut) {
    await shareZoomOut.first().click();
    await sleep(2000);
    const stillCircle = await shareBars.evaluate((el) =>
      el.classList.contains('lovely-chart--state-zoomed-in'));
    check('zoomToShares zoom-out returns to bars', !stillCircle, `still zoomed: ${stillCircle}`);
  }
  await unmountProbe(page);

  // --- A zoom transition clips the plot to the circle and a focused sector's shift, at any plot size ---
  // A narrow column shows the whole circle on a wide page, a short plot closes the clip on its small circle, and a
  // sparkline centers it on its circle, which no axis band moves
  const circleClips = [];
  for (const { name, width, plotHeight, zoomType, isSparkline = false } of [
    { name: 'narrow donut', width: 392, zoomType: 'donut' },
    { name: 'short pie', plotHeight: 160, zoomType: 'pie' },
    { name: 'sparkline pie', plotHeight: 200, zoomType: 'pie', isSparkline: true },
  ]) {
    const circleProbe = await mountProbe(page, {
      width,
      config: {
        type: 'bar',
        isStacked: true,
        title: `Probe — Zoom transition (${name})`,
        zoomToShares: true,
        circleLabelsAround: 0,
        zoomType,
        labels: [0, 1, 2, 3, 4].map((month) => Date.UTC(2029, month, 1)),
        labelType: 'month',
        datasets: [
          { name: 'Alpha', color: '#3497ED', values: [500, 400, 300, 400, 500] },
          { name: 'Beta', color: '#9ED448', values: [500, 600, 700, 600, 500] },
        ],
        plotHeight,
        isSparkline,
      },
    });
    await circleProbe.scrollIntoViewIfNeeded();
    const circlePlot = await circleProbe.locator('.lovely-chart--tooltip').boundingBox();
    await hoverWiggle(page, circlePlot, 0.5, 0.6);
    await page.mouse.click(circlePlot.x + circlePlot.width * 0.5, circlePlot.y + circlePlot.height * 0.6);
    await sleep(2000);
    // A pointer off the chart leaves every sector in place
    await page.mouse.move(0, 0);
    await sleep(600);

    const isCircleZoomed = await circleProbe.evaluate((el) => el.classList.contains('lovely-chart--state-zoomed-in'));
    const box = await circleProbe.locator('canvas').first().boundingBox();
    const { center, radius } = await paintOverProbeCircle(page);
    const zoomIn = await measureCircleTransition(page, { isOut: false, fractions: CIRCLE_IN_FRACTIONS, box, center });
    const zoomOut = await measureCircleTransition(page, { isOut: true, fractions: CIRCLE_OUT_FRACTIONS, box, center });
    const tight = [
      ...zoomIn.filter(({ fraction }) => CIRCLE_IN_TIGHT_FRACTIONS.includes(fraction)),
      ...zoomOut.filter(({ fraction }) => CIRCLE_OUT_TIGHT_FRACTIONS.includes(fraction)),
    ];
    circleClips.push({
      name,
      isCircleZoomed,
      radius,
      shortest: Math.min(...[...zoomIn, ...zoomOut].map(({ shortest }) => shortest)),
      tightest: Math.max(...tight.map(({ longest }) => longest)),
    });
    await unmountProbe(page);
  }
  const describeClips = (key) => circleClips.map((clip) => `${clip.name}: radius ${clip.radius}, reach ${clip[key]}`)
    .join('; ');
  check('a zoom transition never clips the circle or a focused sector',
    circleClips.every(({ isCircleZoomed, radius, shortest }) => (
      isCircleZoomed && shortest >= radius + CIRCLE_SHIFT - CLIP_EDGE_TOLERANCE
    )),
    describeClips('shortest'));
  check('a zoom transition closes its clip on the circle',
    circleClips.every(({ isCircleZoomed, radius, tightest }) => (
      isCircleZoomed && tightest <= radius + CIRCLE_SHIFT + CLIP_EDGE_TOLERANCE
    )),
    describeClips('tightest'));

  // A zoom out of a pie as soon as the zoom in allows it keeps its transition class to the end of the transition
  const quickZoomOut = await page.evaluate(async ({ watch }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeChart = new LovelyChart(element, {
      type: 'bar',
      isStacked: true,
      zoomToShares: true,
      title: 'Probe — Quick zoom out',
      labels: Array.from({ length: 20 }, (_, i) => Date.UTC(2029, 0, 1 + i)),
      datasets: [
        { name: 'A', values: Array.from({ length: 20 }, (_, i) => 300 + (i % 4) * 100) },
        { name: 'B', values: Array.from({ length: 20 }, (_, i) => 500 + (i % 3) * 100) },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 800));
    const container = element.querySelector('.lovely-chart--container');
    const plot = element.querySelector('.lovely-chart--tooltip');
    const { left, top, width, height } = plot.getBoundingClientRect();
    const pointer = { bubbles: true, clientX: left + width / 2, clientY: top + height / 2 };
    plot.dispatchEvent(new MouseEvent('mousemove', pointer));
    plot.dispatchEvent(new MouseEvent('click', pointer));
    // The zoom out control takes a click once the zoom in binds it, and the click leaves the zoomed-in state
    const zoomOutStart = await new Promise((resolve) => {
      const clickZoomOut = () => {
        if (!container.classList.contains('lovely-chart--state-zoomed-in')) {
          resolve(performance.now());
          return;
        }
        element.querySelector('.lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)')?.click();
        requestAnimationFrame(clickZoomOut);
      };
      requestAnimationFrame(clickZoomOut);
    });
    const frames = [];
    await new Promise((resolve) => {
      const readFrame = () => {
        frames.push(container.classList.contains('lovely-chart--state-animating'));
        if (performance.now() - zoomOutStart < watch) {
          requestAnimationFrame(readFrame);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(readFrame);
    });

    return { frames: frames.length, framesWithoutTransition: frames.filter((isAnimating) => !isAnimating).length };
  }, { watch: QUICK_ZOOM_OUT_WATCH });
  await unmountProbe(page);
  check('a zoom out right after the zoom in keeps its transition to the end',
    quickZoomOut.frames > 0 && quickZoomOut.framesWithoutTransition === 0, JSON.stringify(quickZoomOut));

  // A second zoom click before the zoom of the first settles leaves the chart zoomed in, with no page error: stacked bars
  // zoomed to shares, and lines zoomed by `onZoom`
  const doubleZoomCharts = [
    {
      name: 'zoomToShares stacked bars',
      mount: () => mountProbe(page, {
        config: {
          type: 'bar',
          isStacked: true,
          zoomToShares: true,
          title: 'Probe — Double zoom click',
          labels: Array.from({ length: 20 }, (_, i) => Date.UTC(2029, 0, 1 + i)),
          datasets: [
            { name: 'A', values: Array.from({ length: 20 }, (_, i) => 300 + (i % 4) * 100) },
            { name: 'B', values: Array.from({ length: 20 }, (_, i) => 500 + (i % 3) * 100) },
          ],
        },
      }),
    },
    {
      name: 'onZoom lines',
      mount: () => mountLinesZoom(page, {
        overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
        zoomed: [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }],
      }),
    },
  ];
  for (const { name, mount } of doubleZoomCharts) {
    const pageErrorsBefore = errors.filter((error) => error.startsWith('[pageerror]')).length;
    const doubleZoomChart = await mount();
    await doubleZoomChart.evaluate(async (container, gap) => {
      const plot = container.querySelector('.lovely-chart--tooltip');
      const { left, top, width, height } = plot.getBoundingClientRect();
      // A pointer moves before each click, which lets the tooltip take the second one
      const clickAt = (fx) => {
        const pointer = { bubbles: true, clientX: left + width * fx, clientY: top + height / 2 };
        plot.dispatchEvent(new MouseEvent('mousemove', pointer));
        plot.dispatchEvent(new MouseEvent('click', pointer));
      };
      clickAt(0.9);
      await new Promise((resolve) => setTimeout(resolve, gap));
      clickAt(0.85);
    }, DOUBLE_ZOOM_CLICK_GAP);
    await sleep(2000);
    const isZoomedIn = (await doubleZoomChart
      .locator('.lovely-chart--header-zoom-out-control:not(.lovely-chart--state-hidden)').count()) > 0;
    const doubleZoomErrors = errors.filter((error) => error.startsWith('[pageerror]')).slice(pageErrorsBefore);
    await unmountProbe(page);
    check(`two zoom clicks ${DOUBLE_ZOOM_CLICK_GAP}ms apart zoom ${name} in with no page error`,
      isZoomedIn && !doubleZoomErrors.length, `zoomed in: ${isZoomedIn}, ${doubleZoomErrors.join('; ').slice(0, 200)}`);
  }

  // A rebuild returns a zoomed chart to its overview, which `onZoomChange` reports
  const mountZoomedShares = () => page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const data = await fetch('./data/bars.json').then((response) => response.json());
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeLog = [];
    window.probeParams = {
      ...data,
      title: 'Probe — Zoom reports',
      zoomToShares: true,
      onZoomChange: (labelValue) => window.probeLog.push(labelValue === undefined ? 'out' : 'in'),
    };
    window.probeChart = new LovelyChart(element, { ...window.probeParams, initialZoom: 'last' });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    return [...window.probeLog];
  });
  const zoomedBeforeResize = await mountZoomedShares();
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport.width - 20, height: viewport.height });
  await sleep(1200);
  await page.setViewportSize(viewport);
  await sleep(1200);
  const zoomAfterResize = await page.evaluate(() => window.probeLog);
  await unmountProbe(page);
  const zoomedBeforeUpdate = await mountZoomedShares();
  const zoomAfterUpdate = await page.evaluate(async () => {
    window.probeChart.update(window.probeParams);
    await new Promise((resolve) => setTimeout(resolve, 600));
    return window.probeLog;
  });
  await unmountProbe(page);
  check('a resize out of a zoom reports the zoom-out',
    JSON.stringify(zoomedBeforeResize) === '["in"]' && JSON.stringify(zoomAfterResize) === '["in","out"]',
    JSON.stringify(zoomAfterResize));
  check('update() out of a zoom reports the zoom-out',
    JSON.stringify(zoomedBeforeUpdate) === '["in"]' && JSON.stringify(zoomAfterUpdate) === '["in","out"]',
    JSON.stringify(zoomAfterUpdate));

  // --- update() and destroy() of a chart mid-interaction ---
  const updated = await interruptProbe(page, 'update');
  const updatedProbe = page.locator('#probe .lovely-chart--container');
  const updatedPaint = [];
  for (const color of INTERRUPTED_COLORS) updatedPaint.push((await findColor(updatedProbe, parseHex(color))).count);
  await unmountProbe(page);
  check('update() mid-interaction throws nothing', updated.errors.length === 0, updated.errors.join('; '));
  check('update() mid-interaction reports nothing of the replaced chart', updated.log.length === 0,
    JSON.stringify(updated.log));
  check('update() ends a drag of the replaced chart',
    !updated.htmlClass.includes('cursor-') && updated.captionBefore === updated.captionAfter,
    JSON.stringify(updated));
  check('update() mid-interaction draws every dataset of the new data in full colour',
    updatedPaint.every((count) => count > MIN_DATASET_PIXELS), JSON.stringify(updatedPaint));

  // The tooltip that calls `onSelectedIndexChange` carries on after it, with the data of the chart it belongs to
  const rebuildFromCallbackErrors = await page.evaluate(async ({ labels, newLabels }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const errors = [];
    const onError = (e) => errors.push(e.message);
    window.addEventListener('error', onError);
    let isUpdated = false;
    const buildParams = (length) => ({
      type: 'line',
      title: 'Probe — Rebuilt from a callback',
      labels: Array.from({ length }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: [{ name: 'A', values: Array.from({ length }, (_, i) => i) }],
      onSelectedIndexChange: (index) => {
        if (index === undefined || isUpdated) return;
        isUpdated = true;
        window.probeChart.update(buildParams(newLabels));
      },
    });
    const element = document.createElement('div');
    element.id = 'probe';
    document.body.appendChild(element);
    window.probeChart = new LovelyChart(element, buildParams(labels));
    await new Promise((resolve) => setTimeout(resolve, 800));
    const plot = element.querySelector('.lovely-chart--tooltip');
    const { right, top, height } = plot.getBoundingClientRect();
    plot.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: right - 10, clientY: top + height / 2 }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    window.removeEventListener('error', onError);
    return isUpdated ? errors : ['onSelectedIndexChange not called'];
  }, { labels: INTERRUPTED_LABELS, newLabels: INTERRUPTING_LABELS });
  await unmountProbe(page);
  check('update() from onSelectedIndexChange to fewer labels throws nothing', rebuildFromCallbackErrors.length === 0,
    rebuildFromCallbackErrors.join('; '));

  // A page of its own counts every frame and timer, which the demo charts would add to
  const isolatedPage = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const isolatedErrors = [];
  isolatedPage.on('pageerror', (err) => isolatedErrors.push(err.message));
  await isolatedPage.goto(`${url}isolated`);
  await isolatedPage.addStyleTag({ url: `${url}LovelyChart.css` });
  await countLateCallbacks(isolatedPage);
  const destroyed = await interruptProbe(isolatedPage, 'destroy');
  await isolatedPage.close();
  check('destroy() mid-interaction throws nothing and reports nothing',
    destroyed.errors.length === 0 && isolatedErrors.length === 0 && destroyed.log.length === 0,
    JSON.stringify([...isolatedErrors, ...destroyed.log]));
  check('destroy() ends a drag and leaves no frame or timer running',
    !destroyed.htmlClass.includes('cursor-') && destroyed.lateCallbacks === 0,
    `html: "${destroyed.htmlClass}", callbacks after destroy(): ${destroyed.lateCallbacks}`);

  // --- Minimap: a drag holds its cursor over the page until the release ---
  const cursorConfig = {
    title: 'Probe — Drag cursor',
    type: 'line',
    withMinimap: true,
    labels: Array.from({ length: INTERRUPTED_LABELS }, (_, i) => Date.UTC(2026, 0, 1 + i)),
    datasets: [{ name: 'A', values: Array.from({ length: INTERRUPTED_LABELS }, (_, i) => 10 + (i % 4) * 10) }],
  };
  const cursorProbe = await mountProbe(page, { config: cursorConfig });
  await cursorProbe.scrollIntoViewIfNeeded();
  // The cursor classes on `<html>`, and the cursor of the page under them
  const readDragCursor = () => page.evaluate(() => ({
    classes: [...document.documentElement.classList].filter((name) => name.includes('cursor-')),
    cursor: getComputedStyle(document.body).cursor,
  }));
  const cursorSlider = await cursorProbe.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  const offHandle = { x: cursorSlider.x + cursorSlider.width / 2, y: cursorSlider.y - 200 };
  const dragCursor = {};
  await page.mouse.move(cursorSlider.x + cursorSlider.width / 2, cursorSlider.y + cursorSlider.height / 2);
  await page.mouse.down();
  await page.mouse.move(offHandle.x, offHandle.y, { steps: 5 });
  dragCursor.slider = await readDragCursor();
  await page.mouse.move(-20, -20, { steps: 5 });
  await page.mouse.up();
  dragCursor.releasedOutsideWindow = await readDragCursor();
  const cursorEar = await cursorProbe.locator('.lovely-chart--minimap-slider-handle').first().boundingBox();
  await page.mouse.move(cursorEar.x + cursorEar.width / 2, cursorEar.y + cursorEar.height / 2);
  await page.mouse.down();
  await page.mouse.move(offHandle.x, offHandle.y, { steps: 5 });
  dragCursor.ear = await readDragCursor();
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));
  dragCursor.contextMenu = await readDragCursor();
  await page.mouse.up();
  dragCursor.touchCancelled = await page.evaluate(() => {
    const ear = document.querySelector('#probe .lovely-chart--minimap-slider-handle');
    const { left, top } = ear.getBoundingClientRect();
    const touch = new Touch({ identifier: 1, target: ear, clientX: left + 4, clientY: top + 4, pageX: left + 4 });
    const init = { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] };
    ear.dispatchEvent(new TouchEvent('touchstart', init));
    const classes = [...document.documentElement.classList].filter((name) => name.includes('cursor-'));
    document.dispatchEvent(new TouchEvent('touchcancel', { ...init, touches: [], targetTouches: [] }));
    return {
      during: classes,
      after: [...document.documentElement.classList].filter((name) => name.includes('cursor-')),
    };
  });
  await unmountProbe(page);
  check('a slider drag holds the grabbing cursor over the page through a prefixed class',
    JSON.stringify(dragCursor.slider) === '{"classes":["lovely-chart--cursor-grabbing"],"cursor":"grabbing"}',
    JSON.stringify(dragCursor.slider));
  check('an ear drag holds the resize cursor over the page through a prefixed class',
    JSON.stringify(dragCursor.ear) === '{"classes":["lovely-chart--cursor-ew-resize"],"cursor":"ew-resize"}',
    JSON.stringify(dragCursor.ear));
  check('a drag lets the cursor go on a release outside the window, a context menu and a cancelled touch',
    [dragCursor.releasedOutsideWindow, dragCursor.contextMenu].every(({ classes, cursor }) => (
      classes.length === 0 && cursor === 'auto'
    ))
    && JSON.stringify(dragCursor.touchCancelled) === '{"during":["lovely-chart--cursor-ew-resize"],"after":[]}',
    JSON.stringify(dragCursor));

  const stopperProbe = await mountProbe(page, { config: { ...cursorConfig, title: 'Probe — Drag released unseen' } });
  await stopperProbe.scrollIntoViewIfNeeded();
  // A release the document never sees in the bubbling phase, over an element of the page that stops it
  const stoppedSlider = await stopperProbe.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  const stopperCenter = { x: stoppedSlider.x + stoppedSlider.width / 2, y: stoppedSlider.y - 200 };
  await page.evaluate(({ x, y }) => {
    const stopper = document.createElement('div');
    stopper.id = 'probe-stopper';
    stopper.style.cssText = `position: fixed; left: ${x - 50}px; top: ${y - 50}px; width: 100px; height: 100px`;
    stopper.addEventListener('mouseup', (e) => e.stopPropagation());
    document.body.appendChild(stopper);
  }, stopperCenter);
  await page.mouse.move(stoppedSlider.x + stoppedSlider.width / 2, stoppedSlider.y + stoppedSlider.height / 2);
  await page.mouse.down();
  await page.mouse.move(stopperCenter.x, stopperCenter.y, { steps: 5 });
  dragCursor.overStopper = await readDragCursor();
  await page.mouse.up();
  dragCursor.releasedOverStopper = await readDragCursor();
  await page.evaluate(() => document.getElementById('probe-stopper').remove());
  await sleep(600);
  // A release over a frame reaches neither the document nor the chart, whose next move comes with no button pressed
  dragCursor.movedWithoutButton = await page.evaluate(async () => {
    const slider = document.querySelector('#probe .lovely-chart--minimap-slider-inner');
    const { left, top, width, height } = slider.getBoundingClientRect();
    const fire = (target, type, clientX, buttons) => target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, buttons, clientX, clientY: top + height / 2,
    }));
    fire(slider, 'mousedown', left + width / 2, 1);
    fire(document, 'mousemove', left + width / 2 + 40, 0);
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      classes: [...document.documentElement.classList].filter((name) => name.includes('cursor-')),
      sliderShift: slider.getBoundingClientRect().left - left,
    };
  });
  await unmountProbe(page);
  check('a drag ends on a release over an element that stops it, and on a move with no button pressed',
    dragCursor.overStopper.classes.length === 1
    && dragCursor.releasedOverStopper.classes.length === 0 && dragCursor.releasedOverStopper.cursor === 'auto'
    && dragCursor.movedWithoutButton.classes.length === 0 && dragCursor.movedWithoutButton.sliderShift === 0,
    JSON.stringify({
      over: dragCursor.overStopper, stopped: dragCursor.releasedOverStopper, moved: dragCursor.movedWithoutButton,
    }));

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
  const singleLabel = await mountProbe(page, {
    config: {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Zoom to Shares (single label)',
      zoomToShares: true,
      circleLabelsAround: 4,
      zoomType: 'pie',
      labels: [0, 1, 2, 3, 4].map((month) => Date.UTC(2029, month, 1)),
      labelType: 'month',
      // Only the middle label is lopsided, so leaking a neighbour in is obvious
      datasets: [
        { name: 'Alpha', color: '#3497ED', values: [500, 500, 1, 500, 500] },
        { name: 'Beta', color: '#9ED448', values: [500, 500, 999, 500, 500] },
      ],
      withMinimap: true,
      initialZoom: 2,
    },
  });
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
  await unmountProbe(page);
  const edgeZoom = await mountProbe(page, {
    config: {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Zoom to Shares (last label)',
      zoomToShares: true,
      circleLabelsAround: 4,
      zoomType: 'pie',
      labels: [0, 1, 2, 3, 4].map((month) => Date.UTC(2029, month, 1)),
      labelType: 'month',
      datasets: [
        { name: 'Alpha', color: '#3497ED', values: [500, 500, 500, 500, 1] },
        { name: 'Beta', color: '#9ED448', values: [500, 500, 500, 500, 999] },
      ],
      withMinimap: true,
      initialZoom: 'last',
    },
  });
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
  await unmountProbe(page);
  const clickZoom = await mountProbe(page, {
    config: {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Zoom to Shares (click to drill in)',
      zoomToShares: true,
      circleLabelsAround: 4,
      zoomType: 'donut',
      labels: [0, 1, 2, 3, 4].map((month) => Date.UTC(2029, month, 1)),
      labelType: 'month',
      datasets: [
        { name: 'Alpha', color: '#3497ED', values: [500, 400, 300, 400, 500] },
        { name: 'Beta', color: '#9ED448', values: [500, 600, 700, 600, 500] },
      ],
      withMinimap: true,
    },
  });
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

  await unmountProbe(page);

  check('month chart captions its zoom by month, not day',
    monthZoomCaption.trim() === 'March 2029', JSON.stringify(monthZoomCaption));

  // --- Start-zoomed init: async `onZoom`, opened already on the zoomed day ---
  const startZoomedAsync = await mountProbe(page, {
    dataUrl: './data/bars.json',
    config: { title: 'Probe — Start Zoomed onZoom', initialZoom: 'last' },
    zoomDataSource: 'data/zoom_bars',
  });
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
  await unmountProbe(page);

  // --- A zoom paints the zoomed datasets in their own colours, names them, and a zoom out restores the overview ---
  const linesZoomCases = [
    {
      name: 'more',
      overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
      zoomed: [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }, { name: 'Palette' }],
      config: { axisTextColor: ZOOM_AXIS_TEXT_COLOR },
    },
    {
      name: 'fewer',
      overview: [
        { name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }, { name: 'Blue', color: '#0000FF' },
      ],
      zoomed: [{ name: 'Magenta', color: '#FF00FF' }, { name: 'Uncoloured' }],
      config: { initialZoom: 'last' },
    },
    {
      name: 'as many',
      overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
      zoomed: [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }],
      config: { initialZoom: 'last' },
    },
    {
      name: 'as many, of no colours,',
      overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
      zoomed: [{ name: 'Blue' }, { name: 'Magenta' }],
    },
    {
      name: 'as many, with a comparison,',
      overview: [{ name: 'Red', color: '#FF0000' }],
      zoomed: [{ name: 'Blue', color: '#0000FF' }],
      zoomConfig: { comparison: { name: 'Day before', values: [Array(24).fill(35)] } },
    },
  ];
  const countPageErrors = () => errors.filter((error) => error.startsWith('[pageerror]')).length;
  const readTooltipNames = async (labelIndex) => (await readProbeTooltip(page, labelIndex)).names
    .filter((name) => name !== 'Day before').sort();
  const toSortedNames = (datasets) => datasets.map(({ name }) => name).sort();
  for (const { name, overview, zoomed, config = {}, zoomConfig } of linesZoomCases) {
    const pageErrorsBefore = countPageErrors();
    const overviewColors = overview.map(({ color }) => color ?? DEFAULT_PALETTE_COLOR);
    // A zoomed dataset with no colour keeps the colour of the overview's dataset at its place, past which it takes one
    // of the palette
    const zoomedColors = zoomed.map(({ color }, i) => color ?? overview[i]?.color ?? DEFAULT_PALETTE_COLOR);
    const overviewOnlyColors = overviewColors.filter((color) => !zoomedColors.includes(color));
    const zoomedOnlyColors = zoomedColors.filter((color) => !overviewColors.includes(color));
    const allColors = [...new Set([...overviewColors, ...zoomedColors, DEFAULT_COMPARISON_COLOR])];
    const isLinesView = zoomed.length !== overview.length;
    await recordProbeNumbers(page);
    const linesZoom = await mountLinesZoom(page, { overview, zoomed, config, zoomConfig });
    await linesZoom.scrollIntoViewIfNeeded();
    if (!config.initialZoom) {
      const linesZoomPlot = await linesZoom.locator('.lovely-chart--tooltip').boundingBox();
      await hoverWiggle(page, linesZoomPlot, 0.5, 0.5);
      await page.mouse.click(linesZoomPlot.x + linesZoomPlot.width / 2, linesZoomPlot.y + linesZoomPlot.height / 2);
      await sleep(2000);
    }
    const zoomedTexts = getLastFrameTexts(await readProbeTexts(page));
    const zoomedPaint = await readDatasetPaint(linesZoom, allColors);
    const zoomedNames = await readTooltipNames(1);
    // Rows the tooltip makes while zoomed take the overview's names after a zoom out
    await linesZoom.locator('.lovely-chart--button').first().click();
    await sleep(500);
    await linesZoom.locator('.lovely-chart--button').first().click();
    await sleep(500);
    const reshownNames = await readTooltipNames(1);
    await page.evaluate(() => window.probeChart.selectLabel(undefined));
    check(`a zoom into ${name} datasets ${isLinesView ? 'than' : 'as'} the overview paints and names them as their own`,
      countPageErrors() === pageErrorsBefore
      && isPaintedWith(zoomedPaint, zoomedColors, overviewOnlyColors, !isLinesView)
      && (!zoomConfig?.comparison || zoomedPaint.plot[DEFAULT_COMPARISON_COLOR] > MIN_DATASET_PIXELS)
      && JSON.stringify(zoomedNames) === JSON.stringify(toSortedNames(zoomed))
      && JSON.stringify(reshownNames) === JSON.stringify(toSortedNames(zoomed))
      && (!config.axisTextColor || zoomedTexts.every(({ color }) => isTextColor(color, config.axisTextColor))),
      `${JSON.stringify(zoomedPaint)}, tooltip ${zoomedNames} then ${reshownNames}, `
      + `text colours ${JSON.stringify([...new Set(zoomedTexts.map(({ color }) => color))])}`);

    await linesZoom.locator('.lovely-chart--header-zoom-out-control').first().click();
    await sleep(2000);
    const overviewPaint = await readDatasetPaint(linesZoom, allColors);
    const overviewNames = await readTooltipNames(LINES_ZOOM_LAST_LABEL_INDEX);
    check(`a zoom out of ${name} datasets paints and names the overview's as before`,
      countPageErrors() === pageErrorsBefore
      && isPaintedWith(overviewPaint, overviewColors, [...zoomedOnlyColors, DEFAULT_COMPARISON_COLOR])
      && JSON.stringify(overviewNames) === JSON.stringify(toSortedNames(overview)),
      `${JSON.stringify(overviewPaint)}, tooltip ${overviewNames}`);
    await unmountProbe(page);
  }

  // --- A lines zoom draws its datasets in the `colors` its data gives them, over their own ---
  const keyedColors = ['#00FFFF', '#FF00FF', '#FFFF00'];
  const unkeyedColors = ['#0000FF', DEFAULT_PALETTE_COLOR];
  const keyedOverviewColors = ['#FF0000', '#00FF00'];
  const keyedPaintColors = [...keyedColors, ...unkeyedColors, ...keyedOverviewColors];
  const keyedZoom = await mountLinesZoom(page, {
    overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
    zoomed: [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }, { name: 'Palette' }],
    zoomConfig: { colors: { y0: '#00FFFF', y2: '#FFFF00' } },
  });
  await keyedZoom.scrollIntoViewIfNeeded();
  const keyedZoomPlot = await keyedZoom.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, keyedZoomPlot, 0.5, 0.5);
  await page.mouse.click(keyedZoomPlot.x + keyedZoomPlot.width / 2, keyedZoomPlot.y + keyedZoomPlot.height / 2);
  await sleep(2000);
  const keyedPaint = await readDatasetPaint(keyedZoom, keyedPaintColors);
  const keyedSwatches = (await readProbeTooltip(page, 1)).swatchColors.sort();
  await page.evaluate(() => window.probeChart.selectLabel(undefined));
  check('a lines zoom draws its datasets in the colors its data gives them, over their own',
    isPaintedWith(keyedPaint, keyedColors, [...unkeyedColors, ...keyedOverviewColors], false)
    && JSON.stringify(keyedSwatches) === JSON.stringify(keyedColors.map(hexToRgb).sort()),
    `${JSON.stringify(keyedPaint)}, tooltip swatches ${JSON.stringify(keyedSwatches)}`);

  await keyedZoom.locator('.lovely-chart--header-zoom-out-control').first().click();
  await sleep(2000);
  const keyedOverviewPaint = await readDatasetPaint(keyedZoom, keyedPaintColors);
  await unmountProbe(page);
  check('a zoom out of a lines view of colors paints the overview in its own colours',
    isPaintedWith(keyedOverviewPaint, keyedOverviewColors, [...keyedColors, ...unkeyedColors]),
    JSON.stringify(keyedOverviewPaint));

  // --- A resize returns a chart zoomed into datasets of other colours to the overview, in the overview's colours ---
  const resizedOverviewColors = ['#FF0000', '#00FF00'];
  const resizedZoomColors = ['#0000FF', '#FF00FF'];
  const resizedZoom = await mountLinesZoom(page, {
    overview: [{ name: 'Red', color: '#FF0000' }, { name: 'Green', color: '#00FF00' }],
    zoomed: [{ name: 'Blue', color: '#0000FF' }, { name: 'Magenta', color: '#FF00FF' }],
  });
  await resizedZoom.scrollIntoViewIfNeeded();
  const resizedZoomPlot = await resizedZoom.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, resizedZoomPlot, 0.5, 0.5);
  await page.mouse.click(resizedZoomPlot.x + resizedZoomPlot.width / 2, resizedZoomPlot.y + resizedZoomPlot.height / 2);
  await sleep(2000);
  await page.mouse.move(0, 0);
  const resizeViewport = page.viewportSize();
  await page.setViewportSize({ width: resizeViewport.width - 20, height: resizeViewport.height });
  await sleep(1200);
  await page.setViewportSize(resizeViewport);
  await sleep(1200);
  const resizedPaint = await readDatasetPaint(resizedZoom, [...resizedOverviewColors, ...resizedZoomColors]);
  await unmountProbe(page);
  check('a resize while zoomed into datasets of other colours paints the overview in its own colours',
    isPaintedWith(resizedPaint, resizedOverviewColors, resizedZoomColors), JSON.stringify(resizedPaint));

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

  // --- Reference lines ---
  // A rule three times the tallest stack lands above the canvas unless the stacked range reaches it
  const referenceStack = await mountProbe(page, {
    config: {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Reference above the stack',
      labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'A', color: '#3497ED', values: [10, 20, 30, 20] }, { name: 'B', values: [5, 5, 5, 5] }],
      referenceLines: [{ value: 105, color: '#FF00FF' }],
    },
  });
  const magenta = await findColor(referenceStack, [255, 0, 255]);
  check('a reference line widens a stacked range to reach it', magenta.count > 50, `${magenta.count}px`);
  await unmountProbe(page);

  // A target-met chart is constant at zero; a transparent pin keeps it on the baseline
  const pinnedZero = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Pinned zero',
      labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'Red cases', color: '#00AA00', values: [0, 0, 0, 0] }],
      referenceLines: [{ value: 1, label: '', color: 'transparent' }],
    },
  });
  const pinnedLine = await findColor(pinnedZero, [0, 170, 0]);
  const plotBottom = await pinnedZero.evaluate((el) => el.querySelector('canvas').clientHeight - 30);
  check('a transparent pin keeps a zero line on the baseline',
    pinnedLine.count > 50 && Math.abs(pinnedLine.meanY - plotBottom) < 4,
    `line at ${pinnedLine.meanY?.toFixed(1)}, plot bottom ${plotBottom}`);
  await unmountProbe(page);

  // --- A constant series sits at the middle height, its one Y label on it, on both axes ---
  const plotCenterY = (PLOT_TOP + PLOT_BOTTOM) / 2;
  for (const [mainValue, secondValue] of [[0.3, 12.1], [1.2, 0.3], [12.1, 1.2]]) {
    await recordProbeNumbers(page);
    const constantChart = await mountProbe(page, {
      config: {
        type: 'line',
        title: 'Probe — Constant series',
        labels: [1, 2, 3, 4, 5, 6, 7].map((day) => Date.UTC(2026, 10, day)),
        datasets: [
          { name: 'Main', color: '#FF0000', values: Array(7).fill(mainValue) },
          // Dashed, so the main line shows through where both run at the middle
          { name: 'Second', color: '#0000FF', values: Array(7).fill(secondValue), isDashed: true },
        ],
        hasSecondYAxis: true,
      },
    });
    const mainLine = await findColor(constantChart, [255, 0, 0], CONSTANT_LINE_BAND);
    const secondLine = await findColor(constantChart, [0, 0, 255], CONSTANT_LINE_BAND);
    const labels = await readProbeNumberLabels(page);
    await unmountProbe(page);
    // A standard Y label sits half a gutter above its tick
    const isLabelOnLine = (value) => labels.some((label) => label.value === value
      && Math.abs(label.y + 5 - plotCenterY) < 1);
    check(`a constant ${mainValue} and a constant ${secondValue} on the second axis sit at the middle, labelled`,
      Math.abs(mainLine.meanY - plotCenterY) < 2 && Math.abs(secondLine.meanY - plotCenterY) < 2
      && labels.length === 2 && isLabelOnLine(mainValue) && isLabelOnLine(secondValue),
      `lines at ${mainLine.meanY?.toFixed(1)} and ${secondLine.meanY?.toFixed(1)} of ${plotCenterY}, `
      + `labels ${JSON.stringify(labels)}`);
  }

  // --- A bar or an area of a constant range spans from zero at a plot edge to its value at the middle height ---
  // A positive fill rises from the bottom edge and a negative one hangs from the top edge, in the minimap too, on
  // either Y axis
  const minimapCenterY = (MINIMAP_PLOT_TOP + MINIMAP_PLOT_BOTTOM) / 2;
  const constantFills = [
    ...[[342], [-342], [342, 342, 342], [-342, -342, -342], [0, 0, 0]].map((values) => ({ type: 'bar', values })),
    ...[[342, 342, 342], [-342, -342, -342]].map((values) => ({ type: 'area', values })),
    ...[[50, 50, 50, 50, 50], [-50, -50, -50, -50, -50]].map((values) => ({
      type: 'bar', values, isOnSecondAxis: true,
    })),
  ];
  for (const { type, values, isOnSecondAxis } of constantFills) {
    const constantDataset = { name: 'Constant', color: '#FF0000', values };
    const constantChart = await mountProbe(page, {
      config: {
        type,
        title: `Probe — Constant ${type}`,
        labels: values.map((_, i) => Date.UTC(2026, 10, 1 + i)),
        datasets: isOnSecondAxis
          ? [{ name: 'Main', color: '#00FF00', values: values.map((_, i) => 100 * (i + 1)) }, constantDataset]
          : [constantDataset],
        hasSecondYAxis: isOnSecondAxis,
        withMinimap: true,
      },
    });
    const plotFill = await findColor(constantChart, [255, 0, 0], CONSTANT_LINE_BAND);
    const minimapFill = await findColor(constantChart.locator('.lovely-chart--minimap'), [255, 0, 0]);
    await unmountProbe(page);
    const axisNote = isOnSecondAxis ? ' on the second axis' : '';
    const subject = values.length === 1
      ? `a single label of ${values[0]}${axisNote} draws`
      : `equal values of ${values[0]}${axisNote} draw`;
    const fill = `${type === 'area' ? 'an' : 'a'} ${type}`;
    const details = `${plotFill.count}px at ${plotFill.meanY?.toFixed(1)}, `
      + `${minimapFill.count}px at ${minimapFill.meanY?.toFixed(1)} in the minimap`;
    if (values[0] === 0) {
      check(`${subject} no ${type}`, plotFill.count === 0 && minimapFill.count === 0, details);
    } else {
      const isPositive = values[0] > 0;
      const plotFillMeanY = ((isPositive ? PLOT_BOTTOM : PLOT_TOP) + plotCenterY) / 2;
      const minimapFillMeanY = ((isPositive ? MINIMAP_PLOT_BOTTOM : MINIMAP_PLOT_TOP) + minimapCenterY) / 2;
      check(`${subject} ${fill} from the plot ${isPositive ? 'bottom' : 'top'} to the middle`,
        plotFill.count > 1000 && Math.abs(plotFill.meanY - plotFillMeanY) < 2
        && minimapFill.count > 100 && Math.abs(minimapFill.meanY - minimapFillMeanY) < 2,
        `${details}, expected at ${plotFillMeanY} and ${minimapFillMeanY}`);
    }
  }

  // --- A single label draws in a column centered in the plot, its X-axis label under it, whatever window the minimap
  // opens on, which spans the whole minimap ---
  for (const type of ['line', 'area', 'bar']) {
    await recordProbeNumbers(page);
    const singleChart = await mountProbe(page, {
      config: {
        type,
        title: `Probe — Single ${type} with the minimap`,
        labels: [Date.UTC(2026, 10, 1)],
        datasets: [{ name: 'Single', color: '#FF0000', values: [342] }],
        withMinimap: true,
      },
    });
    const plotFill = await findColor(singleChart, [255, 0, 0]);
    const middleFill = await findColor(singleChart, [255, 0, 0], SINGLE_LABEL_BAND);
    const singleTexts = await readProbeTexts(page);
    const xLabelXs = getLastFrameTexts(singleTexts).filter(({ align }) => align === 'center').map(({ x }) => x);
    const maskWidths = await singleChart.locator('.lovely-chart--minimap-mask')
      .evaluateAll((masks) => masks.map((mask) => mask.style.width));
    await unmountProbe(page);
    // A bar fills its column across the plot; a line or an area draws a dot in its middle
    const isDrawn = type === 'bar' ? plotFill.count > 1000 : plotFill.count > 10 && middleFill.count === plotFill.count;
    check(`a single-label ${type} with the minimap draws in a centered column, its window over the whole minimap`,
      isDrawn && xLabelXs.length === 1 && Math.abs(xLabelXs[0] - singleTexts.canvasWidth / 2) < 1
      && maskWidths.every((width) => width === '0%'),
      `${plotFill.count}px, ${middleFill.count}px of them mid-plot, X-axis labels at ${JSON.stringify(xLabelXs)} `
      + `of ${singleTexts.canvasWidth}px, minimap masks ${JSON.stringify(maskWidths)}`);
  }

  // --- A Y-axis tick at 0 reads 0, never float noise ---
  await recordProbeNumbers(page);
  await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Ticks through 0',
      labels: [1, 2, 3, 4, 5, 6].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'P&L', values: [-0.9, -0.5, 0.05, -0.3, -0.7, 0.02] }],
    },
  });
  const tickValues = await readProbeNumbers(page);
  await unmountProbe(page);
  check('a Y-axis tick at 0 reads 0', tickValues.includes(0) && tickValues.every((value) => value === 0
    || Math.abs(value) >= FINEST_Y_STEP), JSON.stringify(tickValues));

  // --- A single label in the trillions labels its value instead of freezing the page ---
  // A page of its own, so a freeze holds up none of the checks after it
  const trillionPage = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await trillionPage.goto(`${url}isolated`);
  const trillionTexts = await Promise.race([
    trillionPage.evaluate(async ({ types, value }) => {
      const { default: LovelyChart } = await import('./LovelyChart.js');
      const texts = [];
      const { fillText } = CanvasRenderingContext2D.prototype;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        texts.push(String(text));
        return fillText.call(this, text, ...args);
      };
      const textsByType = {};
      for (const type of types) {
        texts.length = 0;
        const element = document.createElement('div');
        document.body.appendChild(element);
        const chart = new LovelyChart(element, {
          type, labels: [Date.UTC(2026, 10, 1)], datasets: [{ name: 'Huge', values: [value] }],
        });
        await new Promise((resolve) => setTimeout(resolve, 800));
        textsByType[type] = [...new Set(texts)];
        chart.destroy();
        element.remove();
      }
      return textsByType;
    }, { types: ['line', 'bar'], value: TRILLION_VALUE }),
    sleep(FREEZE_TIMEOUT_MS).then(() => undefined),
  ]);
  await trillionPage.close();
  check('a single label in the trillions labels its value',
    trillionTexts !== undefined && Object.values(trillionTexts).every((texts) => texts.some((text) => (
      text.endsWith('T')
      && Math.abs(parseFloat(text) * TRILLION - TRILLION_VALUE) <= TRILLION_VALUE * TRILLION_LABEL_TOLERANCE
    ))),
    trillionTexts ? JSON.stringify(trillionTexts) : `no frame in ${FREEZE_TIMEOUT_MS}ms`);

  // --- Panning the narrowest window across single labels keeps the Y axis to a few labels a frame ---
  await recordProbeNumbers(page);
  const panLabels = Array.from({ length: 40 }, (_, i) => Date.UTC(2026, 0, 1 + i));
  await mountProbe(page, {
    config: {
      type: 'line',
      withMinimap: true,
      title: 'Probe — Narrow pan',
      labels: panLabels,
      datasets: [{ name: 'Visitors', values: panLabels.map((_, i) => Math.round(3000 + 1400 * Math.cos(i / 3))) }],
    },
  });
  await sweepProbe(page, NARROW_PAN_STEP);
  const panTexts = (await readProbeTexts(page)).texts;
  await unmountProbe(page);
  const textsPerFrame = panTexts.reduce((counts, { frame }) => (
    counts.set(frame, (counts.get(frame) ?? 0) + 1)
  ), new Map());
  const mostTextsInFrame = Math.max(...textsPerFrame.values());
  check('panning the narrowest window keeps the Y axis to a few labels a frame',
    mostTextsInFrame <= MAX_PAN_TEXTS_PER_FRAME, `at most ${mostTextsInFrame} texts in a frame`);

  // --- A dashed or dotted line or step draws its pattern, on the plot and the minimap, and outlines its legend button
  // and tooltip swatch in it; a dataset both dashed and dotted draws dots, and an area or bars draw neither ---
  const linePatterns = [
    { flags: { isDashed: true }, pattern: 'dashed', dash: 6, gap: 4, units: 'dashes' },
    { flags: { isDotted: true }, pattern: 'dotted', dash: 2, gap: 3, units: 'dots' },
    { flags: { isDashed: true, isDotted: true }, pattern: 'dotted', dash: 2, gap: 3, units: 'dots' },
  ];
  const isPatternMeasured = ({ count, dashLength, gapLength }, { dash, gap }) => count > 20
    && Math.abs(dashLength - dash) <= 1 && Math.abs(gapLength - gap) <= 1
    && Math.abs(dashLength + gapLength - dash - gap) < 0.5;
  for (const { flags, pattern, dash, gap, units } of linePatterns) {
    const flagNames = Object.keys(flags).join(' + ');
    for (const type of ['line', 'step']) {
      const patternChart = await mountProbe(page, {
        config: {
          type,
          title: `Probe — ${flagNames} ${type}`,
          withMinimap: true,
          minimapRange: 'full',
          labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
          datasets: [{ name: 'Patterned', color: '#0000FF', values: [5, 5, 5, 5], ...flags }],
        },
      });
      const plotPattern = await readBlueLinePattern(patternChart);
      const minimapPattern = await readBlueLinePattern(patternChart.locator('.lovely-chart--minimap'));
      const button = await patternChart.locator('.lovely-chart--button').evaluate((el) => ({
        attributes: ['data-dashed', 'data-dotted'].filter((attribute) => el.hasAttribute(attribute)),
        outline: getComputedStyle(el).borderTopStyle,
      }));
      const patternTooltip = await readProbeTooltip(page, 1);
      await unmountProbe(page);
      const swatches = { dashed: patternTooltip.dashedSwatches, dotted: patternTooltip.dottedSwatches };
      check(`${flagNames} draws a ${type} in ${dash}px ${units} ${gap}px apart, its button and swatch ${pattern}`,
        isPatternMeasured(plotPattern, { dash, gap }) && isPatternMeasured(minimapPattern, { dash, gap })
        && JSON.stringify(button) === JSON.stringify({ attributes: [`data-${pattern}`], outline: pattern })
        && JSON.stringify(swatches) === JSON.stringify({ dashed: [], dotted: [], [pattern]: ['Patterned'] }),
        `plot ${JSON.stringify(plotPattern)}, minimap ${JSON.stringify(minimapPattern)}, `
        + `button ${JSON.stringify(button)}, swatches ${JSON.stringify(swatches)}`);
    }
  }

  for (const type of ['area', 'bar']) {
    const patternedChart = await mountProbe(page, {
      config: {
        type,
        title: `Probe — Dashed and dotted ${type}`,
        labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
        datasets: [
          { name: 'Dashed', color: '#0000FF', values: [5, 6, 5, 6], isDashed: true },
          { name: 'Dotted', color: '#00FF00', values: [4, 5, 4, 5], isDotted: true },
          { name: 'Solid', color: '#FF0000', values: [2, 3, 2, 3] },
        ],
      },
    });
    const patternedButtons = await patternedChart
      .locator('.lovely-chart--button[data-dashed], .lovely-chart--button[data-dotted]').count();
    const patternedTooltip = await readProbeTooltip(page, 1);
    await unmountProbe(page);
    const patternedSwatches = [...patternedTooltip.dashedSwatches, ...patternedTooltip.dottedSwatches];
    check(`isDashed and isDotted leave ${type === 'area' ? 'an area' : 'bars'} solid, legend buttons and swatches too`,
      patternedButtons === 0 && patternedTooltip.swatched.length === 3 && !patternedSwatches.length,
      `${patternedButtons} patterned buttons, patterned swatches ${JSON.stringify(patternedSwatches)}`);
  }

  // --- Panning leaves the dashes and dots of a sloped line, steps and a smooth line in place ---
  const panPhaseLabels = Array.from({ length: PAN_PHASE_LABELS }, (_, i) => Date.UTC(2026, 0, 1 + i));
  const panPhaseCases = [
    { name: 'a dotted line', type: 'line', flags: { isDotted: true } },
    { name: 'a dashed line', type: 'line', flags: { isDashed: true } },
    { name: 'dotted steps', type: 'step', flags: { isDotted: true } },
    { name: 'a dotted smooth line', type: 'line', flags: { isDotted: true }, areLinesSmooth: true },
  ];
  for (const { name, type, flags, areLinesSmooth = false } of panPhaseCases) {
    await mountProbe(page, {
      config: {
        type,
        title: 'Probe — Panned pattern',
        withMinimap: true,
        minimapRange: [0.3, 0.5],
        areLinesSmooth,
        labels: panPhaseLabels,
        datasets: [{
          name: 'Patterned',
          color: '#0000FF',
          values: panPhaseLabels.map((_, i) => PAN_PHASE_VALUES[i % PAN_PHASE_VALUES.length]),
          ...flags,
        }],
      },
    });
    const panPhase = await readPanPhaseShift(page);
    await unmountProbe(page);
    check(`panning ${name} leaves its pattern in place`,
      panPhase.starts > 1 && panPhase.shift <= MAX_PAN_PHASE_SHIFT, JSON.stringify(panPhase));
  }

  // --- Smooth lines curve through their values ---
  const zigzag = {
    type: 'line',
    labels: [1, 2, 3, 4, 5].map((day) => Date.UTC(2026, 10, day)),
    datasets: [{ name: 'Zigzag', color: '#FF0000', values: [0, 10, 0, 10, 0] }],
  };
  // A band of 2px a quarter of the way from the peak at label 1 down to label 2, as fractions of the canvas width
  const quarterBand = (chart) => chart.evaluate((el) => {
    const width = el.querySelector('canvas').clientWidth;
    const x = 10 + (1.25 / 4) * (width - 20);
    return [(x - 1) / width, (x + 1) / width];
  });
  const straightChart = await mountProbe(page, { config: { ...zigzag, title: 'Probe — Straight lines' } });
  const straightQuarter = await findColor(straightChart, [255, 0, 0], await quarterBand(straightChart));
  await unmountProbe(page);
  const smoothChart = await mountProbe(page, {
    config: { ...zigzag, title: 'Probe — Smooth lines', areLinesSmooth: true },
  });
  const smoothQuarter = await findColor(smoothChart, [255, 0, 0], await quarterBand(smoothChart));
  await unmountProbe(page);
  // A monotone curve leaves a peak flat, so a quarter of the way down it runs well above the straight line
  check('areLinesSmooth curves a line through its values',
    straightQuarter.count > 0 && smoothQuarter.count > 0 && straightQuarter.meanY - smoothQuarter.meanY > 10,
    `straight at ${straightQuarter.meanY?.toFixed(1)}, smooth at ${smoothQuarter.meanY?.toFixed(1)}`);

  // --- A missing value in a stacked area ---
  // An absolute stack has no base above a missing value, so the areas above it break there. A percentage
  // chart has one, the shares of the values the label has, so only the missing dataset's own wedge empties.
  const gapLabels = Array.from({ length: 12 }, (_, i) => Date.UTC(2026, 10, 1 + i));
  for (const isPercentage of [false, true]) {
    const gapChart = await mountProbe(page, {
      config: {
        type: 'area',
        isStacked: true,
        isPercentage,
        title: 'Probe — Stack gap',
        labels: gapLabels,
        datasets: [
          { name: 'Low', color: '#0000FF', values: Array(12).fill(30) },
          // `values` marks a missing value with `null`
          // eslint-disable-next-line no-null/no-null
          { name: 'Middle', color: '#00AA00', values: gapLabels.map((_, i) => (i === 5 ? null : 30)) },
          { name: 'Top', color: '#FF0000', values: Array(12).fill(40) },
        ],
      },
    });
    // A band of 6px around a label's column, as fractions of the canvas width
    const columnBand = (labelIndex) => gapChart.evaluate((el, index) => {
      const width = el.querySelector('canvas').clientWidth;
      const x = 10 + (index / 11) * (width - 20);
      return [(x - 3) / width, (x + 3) / width];
    }, labelIndex);
    const topAtGap = await findColor(gapChart, [255, 0, 0], await columnBand(5));
    const topElsewhere = await findColor(gapChart, [255, 0, 0], await columnBand(2));
    await unmountProbe(page);
    const details = `${topAtGap.count}px of the top area at the missing value, ${topElsewhere.count}px at a full one`;
    if (isPercentage) {
      check('a percentage area keeps the areas above a missing value filled',
        topElsewhere.count > 100 && topAtGap.count > topElsewhere.count / 2, details);
    } else {
      check('a stacked area leaves the areas above a missing value unfilled',
        topElsewhere.count > 100 && topAtGap.count === 0, details);
    }
  }

  // --- An area outline runs along every edge of each run of an area split at a gap ---
  const outlineChart = await mountProbe(page, {
    config: {
      type: 'area',
      title: 'Probe — Area outline',
      labels: Array.from({ length: 7 }, (_, i) => Date.UTC(2026, 10, 1 + i)),
      // `values` marks a missing value with `null`
      // eslint-disable-next-line no-null/no-null
      datasets: [{ name: 'Split', color: '#0000FF', values: [20, 30, 20, null, 20, 30, 20] }],
      areaOpacity: 0.25,
      areaBorderColor: '#FF0000',
    },
  });
  // A band of 4px around a label's column, as fractions of the canvas width
  const outlineBand = (labelIndex) => outlineChart.evaluate((el, index) => {
    const width = el.querySelector('canvas').clientWidth;
    const x = 10 + (index / 6) * (width - 20);
    return [(x - 2) / width, (x + 2) / width];
  }, labelIndex);
  // The left and the right edge of the run before the gap, then of the run after it
  const outlineEdges = [];
  for (const labelIndex of [0, 2, 4, 6]) {
    outlineEdges.push((await findColor(outlineChart, [255, 0, 0], await outlineBand(labelIndex))).count);
  }
  await unmountProbe(page);
  const [firstLeft, firstRight, secondLeft, secondRight] = outlineEdges;
  check('areaBorderColor outlines both sides of each run of a split area',
    firstRight > 100 && secondRight > 100 && firstLeft > firstRight / 2 && secondLeft > secondRight / 2,
    `${JSON.stringify(outlineEdges)}px at the left and right edges of either run`);

  // --- A themed area outline takes the colour of the theme, and follows a change of the theme ---
  const wasOutlineThemeDark = await page.evaluate(() => document.documentElement.classList.contains('theme-dark'));
  await page.evaluate(() => document.documentElement.classList.remove('theme-dark'));
  const themedOutlineChart = await mountProbe(page, {
    config: {
      type: 'area',
      title: 'Probe — Themed area outline',
      labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'Outlined', color: '#0000FF', values: [20, 30, 25, 35] }],
      areaOpacity: 0.25,
      areaBorderColor: { light: '#FF0000', dark: '#00FFFF' },
    },
  });
  const readOutlinePixels = async () => [
    (await findColor(themedOutlineChart, [255, 0, 0])).count,
    (await findColor(themedOutlineChart, [0, 255, 255])).count,
  ];
  const lightOutline = await readOutlinePixels();
  await page.evaluate(() => document.documentElement.classList.add('theme-dark'));
  await sleep(300);
  const darkOutline = await readOutlinePixels();
  await unmountProbe(page);
  await page.evaluate((isDark) => document.documentElement.classList.toggle('theme-dark', isDark), wasOutlineThemeDark);
  check('a themed areaBorderColor outlines an area in the colour of the theme as the theme changes',
    lightOutline[0] > 100 && lightOutline[1] === 0 && darkOutline[0] === 0 && darkOutline[1] > 100,
    `red and cyan px: ${JSON.stringify(lightOutline)} in the light theme, ${JSON.stringify(darkOutline)} in the dark`);

  // --- The outward Y-label column fits the widest label the data can show, and holds still ---
  const columnLabels = Array.from({ length: 120 }, (_, i) => Date.UTC(2026, 0, 1 + i));
  const columnConfig = {
    type: 'line',
    title: 'Probe — Label column',
    withMinimap: true,
    isYAxisOutward: true,
    labels: columnLabels,
    datasets: [
      {
        name: 'High',
        color: '#FF0000',
        values: columnLabels.map((_, i) => 6000 + Math.round(300 * Math.sin(i / 7)) + i * 3),
      },
      { name: 'Low', color: '#0000FF', values: columnLabels.map((_, i) => 2000 + Math.round(900 * Math.cos(i / 5))) },
    ],
  };
  await recordProbeNumbers(page);
  const columnChart = await mountProbe(page, { config: columnConfig });
  await columnChart.scrollIntoViewIfNeeded();
  const initialColumn = getYLabelColumn(await readProbeTexts(page));
  // The narrowest window, panned, then with the low dataset hidden, so the window starts above 0
  const columnEar = await columnChart.locator('.lovely-chart--minimap-slider-handle').first().boundingBox();
  await drag(page, columnEar.x + columnEar.width / 2, columnEar.y + columnEar.height / 2, 600, 0, 20);
  await sleep(700);
  const columnSlider = await columnChart.locator('.lovely-chart--minimap-slider-inner').boundingBox();
  await drag(page, columnSlider.x + columnSlider.width / 2, columnSlider.y + columnSlider.height / 2, -300, 0, 30);
  await sleep(700);
  await columnChart.locator('.lovely-chart--button').nth(1).click();
  await sleep(1000);
  const pannedColumn = getYLabelColumn(await readProbeTexts(page));
  const pannedEnds = [...new Set([...initialColumn.ends, ...pannedColumn.ends])];
  check('an outward Y-label column holds still while the reader narrows, pans and hides datasets',
    pannedEnds.length === 1 && pannedColumn.texts.some((text) => !initialColumn.texts.includes(text)),
    `ends at ${JSON.stringify(pannedEnds)}, labels ${initialColumn.texts.join(' ')} `
    + `then ${pannedColumn.texts.join(' ')}`);
  check('the outward column fits its widest label, and no wider',
    pannedColumn.overflowing.length === 0 && pannedColumn.end - GUTTER - pannedColumn.widest < 1,
    `ends at ${pannedColumn.end}, widest label ${pannedColumn.widest.toFixed(2)}px, `
    + `overflowing: ${JSON.stringify(pannedColumn.overflowing)}`);
  // The plot is clipped from the pixel where the column ends, so the band stops half a pixel short of it
  const columnFraction = await columnChart.evaluate(
    (el, end) => (end - 0.5) / el.querySelector('canvas').clientWidth,
    pannedColumn.end,
  );
  const inColumn = await findColor(columnChart, [255, 0, 0], [0, columnFraction]);
  const inPlot = await findColor(columnChart, [255, 0, 0], [columnFraction, 1]);
  check('a panned plot stays out of the Y-label column', inColumn.count === 0 && inPlot.count > 100,
    `${inColumn.count}px in the column, ${inPlot.count}px in the plot`);

  await page.evaluate(() => window.probeChart.update({
    type: 'line',
    isYAxisOutward: true,
    labels: [1, 2, 3].map((day) => Date.UTC(2026, 0, day)),
    datasets: [{ name: 'Small', values: [0.5, 1.25, 0.75] }],
  }));
  await sleep(1500);
  const updatedColumn = getYLabelColumn(await readProbeTexts(page), true);
  await unmountProbe(page);
  check('update() measures the outward column for the new data',
    updatedColumn.end < pannedColumn.end && updatedColumn.overflowing.length === 0,
    `ends at ${updatedColumn.end} after ${pannedColumn.end}, labels ${updatedColumn.texts.join(' ')}`);

  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...columnConfig, title: 'Probe — Label column, 14px', axisFontSize: 14 } });
  const largeFontColumn = getYLabelColumn(await readProbeTexts(page));
  await unmountProbe(page);
  check('a larger axis font widens the outward column to fit',
    largeFontColumn.ends.length === 1 && largeFontColumn.end > pannedColumn.end
    && largeFontColumn.overflowing.length === 0,
    `ends at ${JSON.stringify(largeFontColumn.ends)} at 14px, ${pannedColumn.end} at 10px`);

  // A zoom swaps in the day's data, which brings a column of its own, and a zoom out brings back the overview's
  const zoomColumnConfig = { title: 'Probe — Label column zoom', isYAxisOutward: true };
  await recordProbeNumbers(page);
  await mountProbe(page, { dataUrl: './data/bars.json', config: zoomColumnConfig });
  const overviewColumn = getYLabelColumn(await readProbeTexts(page), true);
  const overviewAreaLeft = await readPlotAreaLeft(page);
  await unmountProbe(page);
  await recordProbeNumbers(page);
  const zoomColumnChart = await mountProbe(page, {
    dataUrl: './data/bars.json',
    config: { ...zoomColumnConfig, initialZoom: 'last' },
    zoomDataSource: 'data/zoom_bars',
    zoomConfig: { isYAxisOutward: true },
  });
  await sleep(1000);
  const dayColumn = getYLabelColumn(await readProbeTexts(page), true);
  const dayAreaLeft = await readPlotAreaLeft(page);
  await zoomColumnChart.locator('.lovely-chart--header-zoom-out-control').first().click();
  await sleep(2500);
  const zoomedOutColumn = getYLabelColumn(await readProbeTexts(page), true);
  const zoomedOutAreaLeft = await readPlotAreaLeft(page);
  await unmountProbe(page);
  check('a zoom into a day measures an outward column of its own, and a zoom out the overview\'s',
    dayColumn.ends.length === 1 && dayColumn.end !== overviewColumn.end && dayColumn.overflowing.length === 0
    && zoomedOutColumn.end === overviewColumn.end,
    `overview ${overviewColumn.end} (${overviewColumn.texts.join(' ')}), day ${JSON.stringify(dayColumn.ends)} `
    + `(${dayColumn.texts.join(' ')}), zoomed out ${zoomedOutColumn.end}`);
  check('a zoom into a day and out of it moves the plot area to the column on screen',
    overviewAreaLeft === overviewColumn.end + Y_AXIS_LABEL_GAP && dayAreaLeft === dayColumn.end + Y_AXIS_LABEL_GAP
    && zoomedOutAreaLeft === overviewAreaLeft,
    `left ${overviewAreaLeft}, ${dayAreaLeft} zoomed in, ${zoomedOutAreaLeft} zoomed out, `
    + `after labels ending at ${overviewColumn.end}, ${dayColumn.end} and ${zoomedOutColumn.end}`);

  // --- The outward column fits the labels a previous period, a gap, a reference line or a hidden dataset bring ---
  const sweepLabels = (count) => Array.from({ length: count }, (_, i) => Date.UTC(2026, 0, 1 + i));
  // The window of the last week opens on finer steps than its values alone take, its previous values being lower
  await recordProbeNumbers(page);
  await mountProbe(page, {
    config: {
      type: 'line',
      withMinimap: true,
      isYAxisOutward: true,
      title: 'Probe — Column, small counts',
      labels: sweepLabels(7),
      datasets: [{ name: 'Signups', values: [3, 2, 3, 2, 3, 3, 3] }],
      comparison: { name: 'Week before', values: [[4, 2, 2, 2, 4, 2, 3]] },
    },
  });
  const smallCountsColumn = getYLabelColumn(await readProbeTexts(page), true);
  await unmountProbe(page);
  check('an outward column fits the first labels of small counts against a previous period',
    smallCountsColumn.texts.includes('2.2') && smallCountsColumn.overflowing.length === 0,
    `ends at ${JSON.stringify(smallCountsColumn.ends)}, labels ${smallCountsColumn.texts.join(' ')}, `
    + `overflowing: ${JSON.stringify(smallCountsColumn.overflowing)}`);

  const columnSweeps = [{
    name: 'small counts against a previous period',
    config: {
      labels: sweepLabels(7),
      datasets: [{ name: 'Signups', values: [3, 2, 3, 2, 3, 3, 3] }],
      comparison: { name: 'Week before', values: [[4, 2, 2, 2, 4, 2, 3]] },
    },
  }, {
    name: 'a dataset missing a previous value',
    config: {
      labels: sweepLabels(6),
      datasets: [
        { name: 'Web', values: [309.92, 300.5, 310.25, 305.75, 312.5, 308.25] },
        // `values` marks a missing value with `null`
        // eslint-disable-next-line no-null/no-null
        { name: 'App', values: [null, 1500, 1520, 1510, 1490, 1530] },
      ],
      comparison: {
        name: 'Week before',
        // eslint-disable-next-line no-null/no-null
        values: [[299.68, 295, 305, 300, 310, 300], [null, 1480, 1500, 1490, 1470, 1500]],
      },
    },
  }, {
    name: 'mixed signs against a previous period, the positive dataset hidden',
    hiddenIndexes: [1],
    config: {
      labels: sweepLabels(5),
      datasets: [
        { name: 'Refunds', values: [-4.6e6, -4.9e6, -5.2e6, -5.9e6, -5e6] },
        { name: 'Sales', values: [8.9e6, 9e6, 10.5e6, 11.3e6, 11.6e6] },
        { name: 'Fees', values: [-3e6, -4.1e6, -4.3e6, -5.1e6, -3.8e6] },
      ],
      comparison: {
        name: 'Last year',
        values: [
          [-3.8e6, -6.2e6, -3.4e6, -8.1e6, -6.1e6],
          [9.9e6, 12.3e6, 9.1e6, 15.8e6, 7.3e6],
          [-2.1e6, -2.3e6, -2.3e6, -2.8e6, -2.2e6],
        ],
      },
    },
  }, {
    name: 'stacked bars with a gap under a reference line',
    config: {
      type: 'bar',
      isStacked: true,
      labels: sweepLabels(8),
      // eslint-disable-next-line no-null/no-null
      datasets: [{ name: 'A', values: [4.3e9, 4.3e9, 4e9, 4.7e9, 4.9e9, 5.8e9, null, 7.3e9] }],
      referenceLines: [{ value: 1.26e9, label: 'Floor' }],
    },
  }, {
    name: 'whole steps of rates under a target',
    config: {
      noFloatSteps: true,
      labels: sweepLabels(6),
      datasets: [{ name: 'Rate', values: [0.12, 0.3, 0.25, 0.4, 0.33, 0.2] }],
      referenceLines: [{ value: 0.5 }],
    },
  }];
  for (const { name, hiddenIndexes = [], config } of columnSweeps) {
    await recordProbeNumbers(page);
    const sweptChart = await mountProbe(page, {
      config: { type: 'line', withMinimap: true, isYAxisOutward: true, title: `Probe — Column, ${name}`, ...config },
    });
    await sweptChart.scrollIntoViewIfNeeded();
    for (const index of hiddenIndexes) {
      await sweptChart.locator('.lovely-chart--button').nth(index).click();
    }
    await sweepProbe(page);
    const sweptColumn = getYLabelColumn(await readProbeTexts(page));
    await unmountProbe(page);
    check(`an outward column fits every label of ${name}`,
      sweptColumn.ends.length === 1 && sweptColumn.overflowing.length === 0,
      `ends at ${JSON.stringify(sweptColumn.ends)}, widest ${sweptColumn.widest.toFixed(2)}px, `
      + `overflowing: ${JSON.stringify(sweptColumn.overflowing)}`);
  }

  // --- Contrast labels stand in from either side of the chart, the second axis's too ---
  const twoAxesLabels = Array.from({ length: 30 }, (_, i) => Date.UTC(2026, 0, 1 + i));
  const twoAxesConfig = {
    type: 'line',
    hasSecondYAxis: true,
    labels: twoAxesLabels,
    datasets: [
      { name: 'Views', values: twoAxesLabels.map((_, i) => 4000 + Math.round(1500 * Math.sin(i / 6))) },
      { name: 'Rate', values: twoAxesLabels.map((_, i) => Math.round(30 + 12 * Math.cos(i / 5))) },
    ],
  };
  // How far in from its side of the canvas each axis prints its labels: left-aligned for the main one inside the
  // plot, right-aligned right of the middle for the second one
  const readYLabelInsets = async () => {
    const { texts, canvasWidth } = await readProbeTexts(page);
    const secondTexts = texts.filter(({ align, x }) => align === 'right' && x > canvasWidth / 2);
    return {
      main: [...new Set(texts.filter(({ align }) => align === 'left').map(({ x }) => x))],
      second: [...new Set(secondTexts.map(({ x }) => canvasWidth - x))],
    };
  };
  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...twoAxesConfig, title: 'Probe — Default labels' } });
  const defaultInsets = await readYLabelInsets();
  const defaultNumbers = await readProbeNumberLabels(page);
  await unmountProbe(page);
  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...twoAxesConfig, title: 'Probe — Contrast labels', areLabelsContrast: true } });
  const contrastInsets = await readYLabelInsets();
  const contrastNumbers = await readProbeNumberLabels(page);
  await unmountProbe(page);
  // A standard label stands half a gutter above its tick, its bottom on the line, and a contrast one on the tick
  const isCenteredOnTick = defaultNumbers.length > 1 && defaultNumbers.every(({ value, y, baseline }) => {
    const contrastLabel = contrastNumbers.find((label) => label.value === value);
    return baseline === 'bottom' && contrastLabel?.baseline === 'middle'
      && Math.abs(contrastLabel.y - (y + GUTTER / 2)) < 0.01;
  });
  check('areLabelsContrast centers each label on its grid line', isCenteredOnTick,
    `default ${JSON.stringify(defaultNumbers)}, contrast ${JSON.stringify(contrastNumbers)}`);
  const contrastInset = GUTTER + CONTRAST_LABEL_PADDING;
  check('areLabelsContrast moves the labels of either axis 2px in from their side',
    JSON.stringify(defaultInsets) === JSON.stringify({ main: [GUTTER], second: [GUTTER] })
    && JSON.stringify(contrastInsets) === JSON.stringify({ main: [contrastInset], second: [contrastInset] }),
    `default ${JSON.stringify(defaultInsets)}, contrast ${JSON.stringify(contrastInsets)}`);

  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...twoAxesConfig, title: 'Probe — Outward labels', isYAxisOutward: true } });
  const outwardColumn = getYLabelColumn(await readProbeTexts(page));
  await unmountProbe(page);
  await recordProbeNumbers(page);
  await mountProbe(page, {
    config: {
      ...twoAxesConfig, title: 'Probe — Outward contrast labels', isYAxisOutward: true, areLabelsContrast: true,
    },
  });
  const outwardContrastTexts = await readProbeTexts(page);
  const outwardContrastColumn = getYLabelColumn(outwardContrastTexts);
  const outwardSecondInsets = [...new Set(outwardContrastTexts.texts
    .filter(({ align, x }) => align === 'right' && x > outwardContrastTexts.canvasWidth / 2)
    .map(({ x }) => outwardContrastTexts.canvasWidth - x))];
  await unmountProbe(page);
  check('an outward contrast column ends 2px further in, the second axis staying inside the plot',
    outwardContrastColumn.end === outwardColumn.end + CONTRAST_LABEL_PADDING
    && JSON.stringify(outwardSecondInsets) === JSON.stringify([contrastInset]),
    `column ends at ${outwardContrastColumn.end} after ${outwardColumn.end}, `
    + `second axis ${JSON.stringify(outwardSecondInsets)} in from the right`);

  // --- A sparkline has no axes, so no column either ---
  await recordProbeNumbers(page);
  const outwardSparkline = await mountProbe(page, {
    config: { ...columnConfig, title: 'Probe — Outward sparkline', withMinimap: false, isSparkline: true },
  });
  const { texts: sparklineTexts } = await readProbeTexts(page);
  const sparklineEdge = await findColor(outwardSparkline, [255, 0, 0], [0, 0.02]);
  await unmountProbe(page);
  check('an outward sparkline draws no labels and runs to its edge',
    sparklineTexts.length === 0 && sparklineEdge.count > 0,
    `${sparklineTexts.length} texts, ${sparklineEdge.count}px of the line at the left edge`);

  // --- The plot-area properties place an overlay over the data area, inside a padded and bordered element ---
  // The first label at the top of the range and the last at its bottom, so the line runs corner to corner
  const areaConfig = {
    type: 'line',
    title: 'Probe — Plot area',
    labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 0, day)),
    datasets: [{ name: 'Corners', color: '#FF0000', values: [100, 20, 80, 0] }],
    referenceLines: [{ value: 50, color: '#0000FF' }],
  };
  await recordProbeNumbers(page);
  await mountProbe(page, { config: areaConfig, hostStyle: PADDED_HOST_STYLE });
  await addPlotAreaOverlay(page);
  const areaFit = await readPlotAreaFit(page, ['#FF0000', '#0000FF']);
  const [areaLine, areaReference] = areaFit.boxes;
  const areaMiddle = (areaFit.overlay.top + areaFit.overlay.bottom) / 2;
  check('the plot-area properties are px lengths',
    areaFit.values.every((value) => PLOT_AREA_PATTERN.test(value)), JSON.stringify(areaFit.values));
  check('a plot-area overlay frames the first and the last point of a full-range line',
    isFramedBy(areaFit.overlay, areaLine),
    `overlay ${formatBox(areaFit.overlay)}, line ${formatBox(areaLine)}`);
  check('a plot-area overlay puts the middle of the Y range on a reference line there',
    Math.abs(areaReference.meanY - areaMiddle) <= PLOT_AREA_TOLERANCE
    && isFramedBy(areaFit.overlay, areaReference, ['left']),
    `overlay middle ${areaMiddle.toFixed(1)}, reference line at ${areaReference.meanY.toFixed(1)} `
    + `from ${areaReference.left.toFixed(1)}`);

  // An update to an outward column and a shorter plot moves the area, and the overlay follows. The reference line
  // stands off the grid lines at the quarters of the range, which would tint it.
  const updatedReferenceFraction = 0.4;
  await page.evaluate(({ config, fraction }) => window.probeChart.update({
    ...config,
    datasets: [{ ...config.datasets[0], values: config.datasets[0].values.map((value) => value * 1000) }],
    referenceLines: [{ value: fraction * 100000, color: '#0000FF' }],
    isYAxisOutward: true,
    plotHeight: 240,
  }), { config: areaConfig, fraction: updatedReferenceFraction });
  await sleep(1200);
  const updatedFit = await readPlotAreaFit(page, ['#FF0000', '#0000FF']);
  const [updatedLine, updatedReference] = updatedFit.boxes;
  const updatedChildren = await page.evaluate(() => [...document.getElementById('probe').children]
    .map((child) => child.id || child.className));
  check('update() rebuilds the chart under the overlay added after it',
    JSON.stringify(updatedChildren) === JSON.stringify(['lovely-chart--container', 'probe-overlay']),
    JSON.stringify(updatedChildren));
  const areaColumn = getYLabelColumn(await readProbeTexts(page), true);
  check('update() moves the plot area to an outward column and a shorter plot',
    isFramedBy(updatedFit.overlay, updatedLine)
    && Math.abs(updatedFit.overlay.left - (areaColumn.end + Y_AXIS_LABEL_GAP)) <= PLOT_AREA_TOLERANCE
    && updatedFit.overlay.bottom < areaFit.overlay.bottom - 50
    && Math.abs(updatedReference.meanY - updatedFit.overlay.bottom
      + updatedReferenceFraction * (updatedFit.overlay.bottom - updatedFit.overlay.top)) <= PLOT_AREA_TOLERANCE,
    `overlay ${formatBox(updatedFit.overlay)} after ${formatBox(areaFit.overlay)}, line ${formatBox(updatedLine)}, `
    + `labels end at ${areaColumn.end}, reference line at ${updatedReference.meanY.toFixed(1)}`);

  const destroyedValues = await page.evaluate(() => {
    const host = document.getElementById('probe');
    window.probeChart.destroy();
    const values = ['left', 'top', 'width', 'height']
      .map((key) => host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`));
    host.remove();
    return values;
  });
  check('destroy() removes the plot-area properties', destroyedValues.every((value) => value === ''),
    JSON.stringify(destroyedValues));

  // A pie fills the square around its circle, and a sparkline its plot inset from every edge
  await mountProbe(page, {
    config: {
      type: 'pie',
      title: 'Probe — Plot area pie',
      labels: areaConfig.labels,
      datasets: [{ name: 'A', values: [5, 3, 6, 2] }, { name: 'B', values: [2, 4, 1, 3] }],
    },
    hostStyle: PADDED_HOST_STYLE,
  });
  await addPlotAreaOverlay(page);
  const pieFit = await readPlotAreaFit(page, ['any']);
  await unmountProbe(page);
  check('a pie\'s plot area is the square around its circle',
    isFramedBy(pieFit.overlay, pieFit.boxes[0])
    && Math.abs(pieFit.overlay.right - pieFit.overlay.left - (pieFit.overlay.bottom - pieFit.overlay.top)) < 0.01,
    `overlay ${formatBox(pieFit.overlay)}, pie ${formatBox(pieFit.boxes[0])}`);

  await mountProbe(page, {
    config: { ...areaConfig, title: 'Probe — Plot area sparkline', isSparkline: true, plotHeight: 64 },
    hostStyle: PADDED_HOST_STYLE,
  });
  await addPlotAreaOverlay(page);
  const sparklineFit = await readPlotAreaFit(page, ['#FF0000']);
  await unmountProbe(page);
  check('a sparkline\'s plot area is its plot inset by 2px',
    isFramedBy(sparklineFit.overlay, sparklineFit.boxes[0])
    && sparklineFit.overlay.left === SPARKLINE_INSET && sparklineFit.overlay.top === SPARKLINE_INSET,
    `overlay ${formatBox(sparklineFit.overlay)}, line ${formatBox(sparklineFit.boxes[0])}`);

  // A flat sparkline fills from its bottom edge to the middle of its 2px inset
  const flatSparkline = await mountProbe(page, {
    config: {
      type: 'area',
      isSparkline: true,
      labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'Flat', color: '#FF0000', values: [7, 7, 7, 7] }],
    },
  });
  const sparklineFill = await findColor(flatSparkline, [255, 0, 0]);
  const sparklineHeight = await flatSparkline.evaluate((el) => el.querySelector('canvas').clientHeight);
  await unmountProbe(page);
  const sparklineFillMeanY = (sparklineHeight / 2 + sparklineHeight - SPARKLINE_INSET) / 2;
  check('a flat sparkline area fills from its bottom to the middle',
    sparklineFill.count > 1000 && Math.abs(sparklineFill.meanY - sparklineFillMeanY) < 2,
    `${sparklineFill.count}px at ${sparklineFill.meanY?.toFixed(1)}, expected at ${sparklineFillMeanY}`);

  // A scaled element, as in a dashboard scaled to fit, takes the plot area in px of its own
  const readPlotAreaValues = () => page.evaluate(() => {
    const { style } = document.getElementById('probe');
    return ['left', 'top', 'width', 'height']
      .map((key) => parseFloat(style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
  });
  await mountProbe(page, { config: areaConfig, hostStyle: PADDED_HOST_STYLE, width: SCALED_HOST_WIDTH });
  const unscaledArea = await readPlotAreaValues();
  await unmountProbe(page);
  await mountProbe(page, {
    config: areaConfig,
    hostStyle: `${PADDED_HOST_STYLE}; transform: scale(${HOST_SCALE}); transform-origin: 0 0`,
    width: SCALED_HOST_WIDTH,
  });
  const scaledArea = await readPlotAreaValues();
  await unmountProbe(page);
  check('a scaled element takes the plot area of its own px',
    scaledArea.every((value, i) => Math.abs(value - unscaledArea[i]) < PLOT_AREA_SCALE_TOLERANCE),
    `${JSON.stringify(scaledArea)} scaled, ${JSON.stringify(unscaledArea)} at full size`);

  // Panning and narrowing the window repaints every frame, and leaves the area as it is
  await page.evaluate(() => {
    window.plotAreaWrites = 0;
    const { setProperty } = CSSStyleDeclaration.prototype;
    CSSStyleDeclaration.prototype.setProperty = function (property, ...args) {
      if (property.startsWith('--lovely-chart-plot-area-') && this === document.getElementById('probe')?.style) {
        window.plotAreaWrites++;
      }
      return setProperty.call(this, property, ...args);
    };
  });
  await recordProbeNumbers(page);
  const pannedAreaChart = await mountProbe(page, {
    config: { ...columnConfig, title: 'Probe — Plot area while panning' },
  });
  await pannedAreaChart.scrollIntoViewIfNeeded();
  await addPlotAreaOverlay(page);
  const builtWrites = await page.evaluate(() => window.plotAreaWrites);
  const builtLeft = await readPlotAreaLeft(page);
  await sweepProbe(page);
  const pannedWrites = await page.evaluate(() => window.plotAreaWrites) - builtWrites;
  const pannedAreaColumn = getYLabelColumn(await readProbeTexts(page), true);
  await unmountProbe(page);
  check('a pan writes no plot-area property, and the area starts after the outward column',
    builtWrites === 4 && pannedWrites === 0 && builtLeft === pannedAreaColumn.end + Y_AXIS_LABEL_GAP,
    `${builtWrites} writes on the build, ${pannedWrites} while panning, left ${builtLeft} `
    + `after labels ending at ${pannedAreaColumn.end}`);

  // --- A web font that loads after the build widens the outward column to fit, and moves the plot area ---
  await page.evaluate(({ family, fontPath }) => {
    const style = document.createElement('style');
    style.id = 'probe-font';
    style.textContent = `@font-face { font-family: ${family}; src: url(${fontPath}) format('truetype'); }
      #probe .lovely-chart--container { font-family: ${family}, sans-serif; }`;
    document.head.appendChild(style);
  }, { family: WIDE_FONT_FAMILY, fontPath: WIDE_FONT_PATH });
  await recordProbeNumbers(page);
  const lateFontChart = await mountProbe(page, { config: { ...columnConfig, title: 'Probe — Late web font' } });
  await lateFontChart.scrollIntoViewIfNeeded();
  const fallbackFontColumn = getYLabelColumn(await readProbeTexts(page), true);
  const fallbackFontLeft = await readPlotAreaLeft(page);
  const writesBeforeFont = await page.evaluate(() => window.plotAreaWrites);
  releaseWideFont();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await sleep(500);
  const fontWrites = await page.evaluate(() => window.plotAreaWrites) - writesBeforeFont;
  // A redraw, as a legend toggle brings, prints the labels in the loaded font
  await lateFontChart.locator('.lovely-chart--button').nth(1).click();
  await sleep(1000);
  const wideFontColumn = getYLabelColumn(await readProbeTexts(page), true);
  const wideFontLeft = await readPlotAreaLeft(page);
  await unmountProbe(page);
  await page.evaluate(() => document.getElementById('probe-font').remove());
  check('a web font that loads after the build widens the outward column to fit its labels',
    wideFontColumn.end > fallbackFontColumn.end && wideFontColumn.overflowing.length === 0,
    `ends at ${fallbackFontColumn.end} in the fallback font, then at ${wideFontColumn.end}, widest label `
    + `${wideFontColumn.widest.toFixed(2)}px, overflowing: ${JSON.stringify(wideFontColumn.overflowing)}`);
  check('a web font that loads after the build moves the plot area once, after the widened column',
    fallbackFontLeft === fallbackFontColumn.end + Y_AXIS_LABEL_GAP
    && wideFontLeft === wideFontColumn.end + Y_AXIS_LABEL_GAP && fontWrites === 4,
    `left ${fallbackFontLeft}, then ${wideFontLeft} in ${fontWrites} writes`);

  // --- A `FontFace` the page adds already loaded fires no `loadingdone`, and the next frame fits the column to it ---
  const loadedFontFamily = `${WIDE_FONT_FAMILY}Loaded`;
  await page.evaluate((family) => {
    const style = document.createElement('style');
    style.id = 'probe-font';
    style.textContent = `#probe .lovely-chart--container { font-family: ${family}, sans-serif; }`;
    document.head.appendChild(style);
  }, loadedFontFamily);
  await recordProbeNumbers(page);
  const loadedFontChart = await mountProbe(page, {
    config: { ...columnConfig, title: 'Probe — Font face added loaded' },
  });
  await loadedFontChart.scrollIntoViewIfNeeded();
  const unloadedFontColumn = getYLabelColumn(await readProbeTexts(page), true);
  await page.evaluate(async ({ family, bytes }) => {
    window.probeFontFace = new FontFace(family, Uint8Array.from(atob(bytes), (char) => char.charCodeAt(0)));
    await window.probeFontFace.load();
    document.fonts.add(window.probeFontFace);
  }, { family: loadedFontFamily, bytes: buildWideFont().toString('base64') });
  await sleep(500);
  await loadedFontChart.locator('.lovely-chart--button').nth(1).click();
  await sleep(1000);
  const loadedFontColumn = getYLabelColumn(await readProbeTexts(page), true);
  const loadedFontLeft = await readPlotAreaLeft(page);
  await unmountProbe(page);
  await page.evaluate(() => {
    document.fonts.delete(window.probeFontFace);
    document.getElementById('probe-font').remove();
  });
  check('a font face added already loaded widens the outward column and moves the plot area on the next frame',
    loadedFontColumn.end > unloadedFontColumn.end && loadedFontColumn.overflowing.length === 0
    && loadedFontLeft === loadedFontColumn.end + Y_AXIS_LABEL_GAP,
    `ends at ${unloadedFontColumn.end} before the font, then at ${loadedFontColumn.end}, widest label `
    + `${loadedFontColumn.widest.toFixed(2)}px, overflowing: ${JSON.stringify(loadedFontColumn.overflowing)}, `
    + `left ${loadedFontLeft}`);

  // --- Whole Y steps for counts, on both axes ---
  const countsConfig = {
    type: 'line',
    labels: [1, 2, 3, 4, 5].map((day) => Date.UTC(2026, 10, day)),
    datasets: [{ name: 'Red cases', values: [0, 1, 2, 1, 0] }, { name: 'Runs', values: [2, 0, 1, 2, 1] }],
    hasSecondYAxis: true,
  };
  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...countsConfig, title: 'Probe — Fractional steps' } });
  const fractionalSteps = await readProbeNumbers(page);
  await unmountProbe(page);
  await recordProbeNumbers(page);
  await mountProbe(page, { config: { ...countsConfig, title: 'Probe — Whole steps', noFloatSteps: true } });
  const wholeSteps = await readProbeNumbers(page);
  await unmountProbe(page);
  check('noFloatSteps labels a count of 0 to 2 in steps of 1',
    fractionalSteps.includes(0.5) && JSON.stringify(wholeSteps) === '[0,1,2]',
    `default: ${JSON.stringify(fractionalSteps)}, whole: ${JSON.stringify(wholeSteps)}`);

  // --- Legend labels contrast with their fills ---
  const legendFills = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Legend fills',
      labels: [1, 2].map((day) => Date.UTC(2026, 10, day)),
      datasets: Object.entries(LEGEND_FILLS).map(([name, color]) => ({ name, color, values: [1, 2] })),
    },
  });
  const legendContrasts = await readLegendLabels(legendFills);
  const illegibleLabels = legendContrasts.filter(({ contrast }) => contrast < MIN_LEGEND_LABEL_CONTRAST);
  check('legend labels contrast with their fills',
    legendContrasts.length === Object.keys(LEGEND_FILLS).length && !illegibleLabels.length,
    JSON.stringify(illegibleLabels.length ? illegibleLabels : legendContrasts.map(({ contrast }) => contrast)));
  const needlesslyDarkLabels = legendContrasts
    .filter(({ whiteContrast, isLabelWhite }) => whiteContrast >= MIN_LEGEND_LABEL_CONTRAST && !isLabelWhite);
  check('legend labels stay white where white reads',
    !needlesslyDarkLabels.length, JSON.stringify(needlesslyDarkLabels));
  await unmountProbe(page);

  const defaultPaletteLegend = await mountProbe(page, {
    config: {
      type: 'line',
      title: 'Probe — Default palette legend',
      labels: [1, 2].map((day) => Date.UTC(2026, 10, day)),
      datasets: DEFAULT_PALETTE.map((_, i) => ({ name: `Dataset ${i + 1}`, values: [1, 2] })),
    },
  });
  const defaultPaletteLabels = await readLegendLabels(defaultPaletteLegend);
  const darkLabelColors = defaultPaletteLabels.filter(({ isLabelWhite }) => !isLabelWhite).map(({ color }) => color);
  check('of the default colours, the light green and the amber alone take dark legend labels',
    JSON.stringify(defaultPaletteLabels.map(({ color }) => color)) === JSON.stringify(DEFAULT_PALETTE)
    && JSON.stringify(darkLabelColors) === JSON.stringify(DARK_LABEL_DEFAULT_COLORS),
    JSON.stringify(defaultPaletteLabels
      .map(({ color, isLabelWhite }) => `${color} ${isLabelWhite ? 'white' : 'dark'}`)));
  await unmountProbe(page);

  // --- Dashed and dotted datasets, comparison and its tooltip (demo charts) ---
  const limitChart = charts.nth(LIMIT_CHART);
  const legendOutlines = await limitChart.locator('.lovely-chart--button')
    .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).borderTopStyle));
  check('dashed and dotted datasets outline their legend buttons with a dash and with dots',
    JSON.stringify(legendOutlines) === '["solid","dashed","dotted"]', JSON.stringify(legendOutlines));

  const comparisonChart = charts.nth(COMPARISON_CHART);
  await comparisonChart.scrollIntoViewIfNeeded();
  const comparisonLegend = await comparisonChart.locator('.lovely-chart--comparison-legend').textContent();
  const comparisonPlot = await comparisonChart.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, comparisonPlot, 0.7, 0.5);
  const comparisonTooltip = await comparisonChart.locator('.lovely-chart--tooltip-balloon').evaluate((el) => ({
    firstRow: el.querySelector('.lovely-chart--tooltip-legend').firstElementChild.className,
    swatches: el.querySelectorAll('.lovely-chart--tooltip-swatch').length,
    titleTotal: el.querySelector('.lovely-chart--tooltip-title-total')?.textContent ?? '',
    hasTotalRow: Boolean(el.querySelector('.lovely-chart--tooltip-dataset-total')),
    change: el.querySelector('.lovely-chart--tooltip-change')?.dataset.tone,
  }));
  check('comparison names its line in the legend', comparisonLegend === 'Week before',
    JSON.stringify(comparisonLegend));
  check('the demo tooltip lists the comparison first, swatches and the total by the title',
    comparisonTooltip.firstRow.includes('lovely-chart--tooltip-dataset-comparison')
    && comparisonTooltip.swatches > 1 && /^\d{1,3}(,\d{3})+$/.test(comparisonTooltip.titleTotal)
    && !comparisonTooltip.hasTotalRow && ['positive', 'negative', 'neutral'].includes(comparisonTooltip.change),
    JSON.stringify(comparisonTooltip));

  // --- Tooltip rows: their look, their order and the total ---
  const rowsConfig = {
    type: 'bar',
    isStacked: true,
    labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
    datasets: TOOLTIP_ROW_VALUES.map((value, i) => ({
      name: `D${i}`, color: TOOLTIP_ROW_COLORS[i], values: [value, value, value],
    })),
    noZoom: true,
  };
  // The 11 largest of the 13 rows fit beside the comparison row
  const largestRows = TOOLTIP_ROW_VALUES.map((value, i) => ({ value, name: `D${i}` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 11);
  const rowsByValue = largestRows.map(({ name }) => name);
  const rowsInLegendOrder = [...rowsByValue].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const rowsTotal = String(TOOLTIP_ROW_VALUES.reduce((sum, value) => sum + value, 0));

  await mountProbe(page, {
    config: {
      ...rowsConfig,
      title: 'Probe — Tooltip rows',
      comparison: { name: 'Before', values: TOOLTIP_ROW_VALUES.map((value) => [value, value * 0.8, value]) },
    },
  });
  const defaultRows = await readProbeTooltip(page, 1);
  await unmountProbe(page);
  check('tooltip rows list the comparison, then the largest values down, then the Total row',
    JSON.stringify(defaultRows.names) === JSON.stringify(['Before', ...rowsByValue, 'Total'])
    && defaultRows.titleTotal === undefined,
    JSON.stringify(defaultRows.names));
  check('tooltip rows carry swatches of their datasets, the comparison a dashed one, and values in the text colour',
    JSON.stringify(defaultRows.swatched) === JSON.stringify(['Before', ...rowsByValue])
    && JSON.stringify(defaultRows.dashedSwatches) === JSON.stringify(['Before'])
    && defaultRows.swatchColors[0] === hexToRgb(DEFAULT_COMPARISON_COLOR)
    && defaultRows.swatchColors.slice(1).every((color, i) => (
      color === hexToRgb(TOOLTIP_ROW_COLORS[Number(rowsByValue[i].slice(1))])
    ))
    && defaultRows.areValuesInTextColor,
    JSON.stringify(defaultRows));
  check('a rise of the comparison change takes --tooltip-change-positive',
    defaultRows.change.text === '+25%' && defaultRows.change.tone === 'positive'
    && defaultRows.change.color === defaultRows.change.positiveColor
    && defaultRows.change.color !== defaultRows.change.textColor,
    JSON.stringify(defaultRows.change));

  await mountProbe(page, {
    config: {
      ...rowsConfig,
      title: 'Probe — Tooltip rows, fixed order, total in the title',
      comparison: { name: 'Before', values: TOOLTIP_ROW_VALUES.map((value) => [value, value * 1.25, value]) },
      isTooltipOrderFixed: true,
      isTooltipTotalInTitle: true,
    },
  });
  const fixedRows = await readProbeTooltip(page, 1);
  await unmountProbe(page);
  check('isTooltipOrderFixed lists the largest values in the order of the legend',
    JSON.stringify(fixedRows.names) === JSON.stringify(['Before', ...rowsInLegendOrder]),
    JSON.stringify(fixedRows.names));
  check('isTooltipTotalInTitle puts the total by the title, with no Total row',
    fixedRows.titleTotal === rowsTotal && !fixedRows.names.includes('Total'),
    `title total: ${fixedRows.titleTotal}, rows: ${JSON.stringify(fixedRows.names)}`);
  await mountProbe(page, {
    config: {
      type: 'area',
      title: 'Probe — Percentage total in the title',
      isPercentage: true,
      isStacked: true,
      isTooltipTotalInTitle: true,
      labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
      datasets: [
        { name: 'A', values: [10, 20, 30] },
        { name: 'B', values: [30, 40, 50] },
      ],
      noZoom: true,
    },
  });
  const percentageRows = await readProbeTooltip(page, 1);
  await unmountProbe(page);
  check('isTooltipTotalInTitle puts the total of a percentage chart by the title',
    percentageRows.titleTotal === '60' && !percentageRows.names.includes('Total'),
    `title total: ${percentageRows.titleTotal}, rows: ${JSON.stringify(percentageRows.names)}`);
  check('a fall of the comparison change takes --tooltip-change-negative',
    fixedRows.change.text === '-20%' && fixedRows.change.tone === 'negative'
    && fixedRows.change.color === fixedRows.change.negativeColor
    && fixedRows.change.color !== fixedRows.change.textColor,
    JSON.stringify(fixedRows.change));

  // A zoom swaps in data of its own, which keeps its total in a row
  const zoomTotal = await mountProbe(page, {
    dataUrl: './data/bars.json',
    config: { title: 'Probe — Title total through a zoom', isTooltipTotalInTitle: true },
    zoomDataSource: 'data/zoom_bars',
  });
  await zoomTotal.scrollIntoViewIfNeeded();
  const readTotals = () => zoomTotal.locator('.lovely-chart--tooltip-balloon').evaluate((el) => {
    const title = el.querySelector('.lovely-chart--tooltip-title');
    const total = el.querySelector('.lovely-chart--tooltip-title-total');
    const chevron = getComputedStyle(title, '::after');

    return {
      titleTotal: total?.textContent,
      hasTotalRow: Boolean(el.querySelector('.lovely-chart--tooltip-dataset-total')),
      totalEnd: total?.getBoundingClientRect().right,
      chevronStart: chevron.display === 'none'
        ? undefined
        : title.getBoundingClientRect().right - parseFloat(chevron.width),
    };
  });
  const zoomTotalPlot = await zoomTotal.locator('.lovely-chart--tooltip').boundingBox();
  // The day data covers the newest dates alone
  const zoomTotalFx = (zoomTotalPlot.width - 5) / zoomTotalPlot.width;
  await hoverWiggle(page, zoomTotalPlot, zoomTotalFx, 0.6);
  const overviewTotals = await readTotals();
  await page.mouse.click(
    zoomTotalPlot.x + zoomTotalPlot.width * zoomTotalFx,
    zoomTotalPlot.y + zoomTotalPlot.height * 0.6,
  );
  await sleep(2000);
  await hoverWiggle(page, zoomTotalPlot, 0.5, 0.6);
  const zoomedTotals = await readTotals();
  await unmountProbe(page);
  check('a zoom into data with its total in a row takes the total off the title',
    Boolean(overviewTotals.titleTotal) && !overviewTotals.hasTotalRow
    && zoomedTotals.titleTotal === undefined && zoomedTotals.hasTotalRow,
    JSON.stringify({ overviewTotals, zoomedTotals }));
  check('the title total of a zoomable balloon stops short of the zoom chevron',
    overviewTotals.chevronStart !== undefined && overviewTotals.totalEnd <= overviewTotals.chevronStart,
    JSON.stringify(overviewTotals));

  // The total on the scale of `secondaryYAxis` scales the total `resolveTooltipTotal` gives. A function cannot cross
  // into the page, so the page builds the chart with the total it is given.
  const readResolvedSecondaryRows = (config, resolvedTotal) => page.evaluate(async ({ spec, total }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeChart = new LovelyChart(element, {
      ...spec,
      title: 'Probe — Resolved secondary total',
      labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'A', values: [100, 200, 300] }, { name: 'B', values: [10, 20, 30] }],
      secondaryYAxis: { label: 'USD ≈', multiplier: 2.5, prefix: '$' },
      resolveTooltipTotal: () => total,
    });
    await new Promise((resolve) => setTimeout(resolve, 800));
    window.probeChart.selectLabel(1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const balloon = element.querySelector('.lovely-chart--tooltip-balloon');
    const rows = [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset')].map((row) => [
      row.dataset.name ?? row.firstElementChild.textContent,
      row.querySelector('.lovely-chart--tooltip-dataset-value').textContent,
    ].join(' '));
    window.probeChart.destroy();
    element.remove();
    return rows;
  }, { spec: config, total: resolvedTotal });
  const resolvedSecondaryRows = {
    resolved: await readResolvedSecondaryRows({ type: 'line' }, 500),
    // `resolveTooltipTotal` marks a missing total with `null`
    // eslint-disable-next-line no-null/no-null
    missing: await readResolvedSecondaryRows({ type: 'line' }, null),
  };
  check('the total on the secondaryYAxis scale scales the total resolveTooltipTotal gives',
    JSON.stringify(resolvedSecondaryRows.resolved) === '["A 200","B 20","USD ≈ $1250.00"]'
    && JSON.stringify(resolvedSecondaryRows.missing) === '["A 200","B 20","USD ≈ —"]',
    JSON.stringify(resolvedSecondaryRows));

  // The total on the scale of `secondaryYAxis` takes a row of its own under the Total row, or under the datasets
  const readSecondaryTotals = async (config) => {
    await mountProbe(page, {
      config: {
        isStacked: true,
        labels: [1, 2, 3].map((day) => Date.UTC(2026, 10, day)),
        datasets: [{ name: 'A', values: [100, 200, 300] }, { name: 'B', values: [10, 20, 30] }],
        secondaryYAxis: { label: 'USD ≈', multiplier: 2.5, prefix: '$' },
        ...config,
      },
    });
    const totals = await page.evaluate(async () => {
      window.probeChart.selectLabel(1);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
      return {
        rows: [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset')].map((row) => [
          row.dataset.name ?? row.firstElementChild.textContent,
          row.querySelector('.lovely-chart--tooltip-dataset-value').textContent,
        ].join(' ')),
        titleTotal: balloon.querySelector('.lovely-chart--tooltip-title-total')?.textContent,
      };
    });
    await unmountProbe(page);
    return totals;
  };
  const secondaryTotals = {
    bar: await readSecondaryTotals({ type: 'bar' }),
    step: await readSecondaryTotals({ type: 'step' }),
    area: await readSecondaryTotals({ type: 'area' }),
    inTitle: await readSecondaryTotals({ type: 'bar', isTooltipTotalInTitle: true }),
    percentage: await readSecondaryTotals({ type: 'area', isPercentage: true }),
    resolved: await readResolvedSecondaryRows({ type: 'bar', isStacked: true }, 500),
    // `resolveTooltipTotal` marks a missing total with `null`
    // eslint-disable-next-line no-null/no-null
    missing: await readResolvedSecondaryRows({ type: 'bar', isStacked: true }, null),
  };
  const rowsWithTotal = '["A 200","B 20","Total 220","USD ≈ $550.00"]';
  check('a stacked chart with secondaryYAxis shows its total and the scaled total on rows of their own',
    JSON.stringify(secondaryTotals.bar.rows) === rowsWithTotal
    && JSON.stringify(secondaryTotals.step.rows) === rowsWithTotal
    && JSON.stringify(secondaryTotals.area.rows) === rowsWithTotal
    && JSON.stringify(secondaryTotals.percentage.rows) === rowsWithTotal
    && secondaryTotals.inTitle.titleTotal === '220'
    && JSON.stringify(secondaryTotals.inTitle.rows) === '["A 200","B 20","USD ≈ $550.00"]'
    && JSON.stringify(secondaryTotals.resolved) === '["A 200","B 20","Total 500","USD ≈ $1250.00"]'
    && JSON.stringify(secondaryTotals.missing) === '["A 200","B 20","Total —","USD ≈ —"]',
    JSON.stringify(secondaryTotals));

  const sparkline = charts.nth(SPARKLINE_CHART);
  const sparklineLayout = await sparkline.evaluate((el) => ({
    header: getComputedStyle(el.querySelector('.lovely-chart--header')).display,
    tools: getComputedStyle(el.querySelector('.lovely-chart--tools')).display,
    height: el.querySelector('canvas').clientHeight,
  }));
  check('a sparkline draws the plot alone at its height',
    sparklineLayout.header === 'none' && sparklineLayout.tools === 'none' && sparklineLayout.height === 64,
    JSON.stringify(sparklineLayout));

  // --- Smooth lines, a dataset that starts hidden and the axis font (demo chart) ---
  const smoothDemoChart = charts.nth(SMOOTH_CHART);
  await smoothDemoChart.scrollIntoViewIfNeeded();
  const smoothDemoButtons = smoothDemoChart.locator('.lovely-chart--button');
  const readSmoothPaint = async () => {
    const pixels = [];
    for (const color of SMOOTH_COLORS) pixels.push((await findColor(smoothDemoChart, parseHex(color))).count);
    const legend = await smoothDemoButtons
      .evaluateAll((buttons) => buttons.map((button) => button.classList.contains('lovely-chart--state-checked')));
    return { legend, pixels };
  };
  const hiddenPaint = await readSmoothPaint();
  await startCanvasRecording(smoothDemoChart);
  await smoothDemoButtons.nth(2).click();
  await sleep(800);
  const nightAxisDrawing = await stopCanvasRecording(page);
  const shownPaint = await readSmoothPaint();
  // The day skin, while the dataset hides again
  await page.evaluate(() => document.documentElement.classList.remove('theme-dark'));
  await sleep(800);
  await startCanvasRecording(smoothDemoChart);
  await smoothDemoButtons.nth(2).click();
  await sleep(800);
  const dayAxisDrawing = await stopCanvasRecording(page);
  await page.evaluate(() => document.documentElement.classList.add('theme-dark'));
  await sleep(800);
  check('a demo dataset that starts hidden leaves its legend button unchecked and its line out until it is checked',
    JSON.stringify(hiddenPaint.legend) === '[true,true,false]'
    && JSON.stringify(shownPaint.legend) === '[true,true,true]'
    && hiddenPaint.pixels.slice(0, 2).every((count) => count > MIN_DATASET_PIXELS) && hiddenPaint.pixels[2] === 0
    && shownPaint.pixels[2] > MIN_DATASET_PIXELS,
    JSON.stringify({ hiddenPaint, shownPaint }));
  check('the smooth demo chart draws its lines as curves', nightAxisDrawing.curves > 0,
    `${nightAxisDrawing.curves} curves`);
  const isSmoothAxisText = ({ texts }, hex) => texts.length > 0 && texts.every(({ font, color }) => (
    font.split(' ').includes(`${SMOOTH_AXIS_FONT_SIZE}px`) && isTextColor(color, hex)
  ));
  check('the demo axis labels take axisFontSize and the axisTextColor of each skin',
    isSmoothAxisText(nightAxisDrawing, SMOOTH_AXIS_COLORS.night)
    && isSmoothAxisText(dayAxisDrawing, SMOOTH_AXIS_COLORS.day),
    JSON.stringify([nightAxisDrawing.texts[0], dayAxisDrawing.texts[0]]));

  // --- An element over the plot by the plot-area variables (demo chart) ---
  const forecastChart = charts.nth(FORECAST_CHART);
  await forecastChart.scrollIntoViewIfNeeded();
  const forecastFit = await forecastChart.evaluate((el, [days, week, hex]) => {
    const host = el.parentElement;
    const band = host.querySelector('.forecast-band');
    const canvas = el.querySelector('canvas');
    const hostBox = host.getBoundingClientRect();
    const toHost = ({ left, top, right, bottom }) => ({
      left: left - hostBox.left - host.clientLeft,
      top: top - hostBox.top - host.clientTop,
      right: right - hostBox.left - host.clientLeft,
      bottom: bottom - hostBox.top - host.clientTop,
    });
    const [left, top, width, height] = ['left', 'top', 'width', 'height']
      .map((key) => parseFloat(host.style.getPropertyValue(`--lovely-chart-plot-area-${key}`)));
    const canvasBox = toHost(canvas.getBoundingClientRect());
    const scale = canvas.width / canvas.clientWidth;
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const line = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (let j = 0; j < data.length; j += 4) {
      if (data[j + 3] <= 100 || rgb.some((channel, k) => Math.abs(data[j + k] - channel) >= 24)) continue;
      const x = canvasBox.left + ((j / 4) % canvas.width) / scale;
      const y = canvasBox.top + Math.floor(j / 4 / canvas.width) / scale;
      line.left = Math.min(line.left, x);
      line.top = Math.min(line.top, y);
      line.right = Math.max(line.right, x + 1 / scale);
      line.bottom = Math.max(line.bottom, y + 1 / scale);
    }
    return {
      area: { left, top, right: left + width, bottom: top + height },
      band: toHost(band.getBoundingClientRect()),
      bandLeft: left + width * (1 - (week - 1) / (days - 1)),
      line,
      isBandBeforeChart: band.nextElementSibling === el,
    };
  }, [FORECAST_DAYS, FORECAST_WEEK, FORECAST_LINE_COLOR]);
  const { area: forecastArea, band: forecastBand, line: forecastLine } = forecastFit;
  const isNear = (a, b) => Math.abs(a - b) <= PLOT_AREA_TOLERANCE;
  check('the demo forecast band stands on the plot area by its variables from the first forecast day, under the chart',
    isNear(forecastBand.top, forecastArea.top) && isNear(forecastBand.bottom, forecastArea.bottom)
    && isNear(forecastBand.right, forecastArea.right) && isNear(forecastBand.left, forecastFit.bandLeft)
    && forecastFit.isBandBeforeChart,
    `band ${formatBox(forecastBand)}, area ${formatBox(forecastArea)}, start ${forecastFit.bandLeft.toFixed(1)}`);
  check('the plot area of the demo forecast frames its line',
    isNear(forecastLine.left, forecastArea.left) && isNear(forecastLine.right, forecastArea.right)
    && forecastLine.top >= forecastArea.top - PLOT_AREA_TOLERANCE
    && forecastLine.bottom <= forecastArea.bottom + PLOT_AREA_TOLERANCE,
    `line ${formatBox(forecastLine)}, area ${formatBox(forecastArea)}`);
  await hoverWiggle(page, await page.locator('.forecast-band').boundingBox(), 0.5, 0.5);
  const forecastBalloon = await forecastChart.locator('.lovely-chart--tooltip-balloon').evaluate((el) => ({
    isShown: el.classList.contains('lovely-chart--state-shown'),
    title: el.querySelector('.lovely-chart--tooltip-title').textContent,
  }));
  await page.mouse.move(5, 5);
  check('the pointer over the demo forecast band reaches the tooltip', forecastBalloon.isShown,
    JSON.stringify(forecastBalloon));

  // --- `selectLabel()` from the page and `onSelectedIndexChange` (demo chart) ---
  const pickerChart = charts.nth(DAY_PICKER_CHART);
  const pickerDays = page.locator('.day-picker-day');
  await page.locator('.day-picker').scrollIntoViewIfNeeded();
  const pickerDates = await page.locator('.day-picker-date').allTextContents();
  const readDayPicker = () => pickerChart.evaluate((el) => {
    const balloon = el.querySelector('.lovely-chart--tooltip-balloon');
    return {
      isShown: balloon.classList.contains('lovely-chart--state-shown'),
      title: balloon.querySelector('.lovely-chart--tooltip-title').textContent.trim(),
      marked: [...document.querySelectorAll('.day-picker-day[aria-current="date"] .day-picker-date')]
        .map((date) => date.textContent),
    };
  });
  const isPickedDay = (picked, i) => picked.isShown && pickerDates[i].endsWith(` ${picked.title}`)
    && JSON.stringify(picked.marked) === JSON.stringify([pickerDates[i]]);
  await pickerDays.nth(2).hover();
  await sleep(400);
  const hoveredDay = await readDayPicker();
  await pickerDays.nth(4).focus();
  await page.keyboard.press('Tab');
  await sleep(400);
  const focusedDay = await readDayPicker();
  const previousDayButton = page.locator('.day-picker-step').first();
  const nextDayButton = page.locator('.day-picker-step').last();
  const readSteppedDay = async (button) => {
    await button.click();
    await sleep(400);
    return readDayPicker();
  };
  const steppedBackDay = await readSteppedDay(previousDayButton);
  const steppedOnDay = await readSteppedDay(nextDayButton);
  const lastDay = await readSteppedDay(nextDayButton);
  const pastLastDay = await readSteppedDay(nextDayButton);
  check('a row of the demo list selects its day in the tooltip on hover, and onSelectedIndexChange marks it',
    isPickedDay(hoveredDay, 2), JSON.stringify(hoveredDay));
  check('the demo list selects a day on keyboard focus and steps the selection with its buttons up to the last day',
    isPickedDay(focusedDay, 5) && isPickedDay(steppedBackDay, 4) && isPickedDay(steppedOnDay, 5)
    && isPickedDay(lastDay, 6) && isPickedDay(pastLastDay, 6),
    JSON.stringify({ focusedDay, steppedBackDay, steppedOnDay, lastDay, pastLastDay }));
  const pickerPlot = await pickerChart.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, pickerPlot, 0.2, 0.5);
  const pointedDay = await readDayPicker();
  await page.mouse.move(5, 5);
  await sleep(400);
  const leftDay = await readDayPicker();
  check('the pointer over the demo chart takes the selection over, and leaving the chart clears it',
    pointedDay.isShown && !pickerDates.some((date) => date.endsWith(` ${pointedDay.title}`))
    && !pointedDay.marked.length && !leftDay.isShown && !leftDay.marked.length,
    JSON.stringify({ pointedDay, leftDay }));
  // A listed day the pointer picks on the chart, which leaves the tooltip as the pointer leaves for a button
  await hoverWiggle(page, pickerPlot, 0.9, 0.5);
  const pointedListedDay = await readDayPicker();
  const pointedListIndex = pickerDates.findIndex((date) => date.endsWith(` ${pointedListedDay.title}`));
  await page.mouse.move(5, 5);
  await sleep(400);
  const stepFromPointedDay = await readSteppedDay(previousDayButton);
  check('the demo buttons step from a day the pointer picked on the chart after it leaves',
    pointedListIndex > 0 && isPickedDay(stepFromPointedDay, pointedListIndex - 1),
    JSON.stringify({ pointedListedDay, stepFromPointedDay }));

  // --- A right-to-left page (demo chart) ---
  const rtlChart = charts.nth(RTL_CHART);
  await rtlChart.scrollIntoViewIfNeeded();
  const rtlButton = rtlChart.locator('.lovely-chart--button').first();
  await startCanvasRecording(rtlChart);
  await rtlButton.click();
  await sleep(600);
  await rtlButton.click();
  await sleep(600);
  const rtlDrawing = await stopCanvasRecording(page);
  await hoverWiggle(page, await rtlChart.locator('.lovely-chart--tooltip').boundingBox(), 0.62, 0.5);
  const rtlTooltipNumbers = await readNegativeTooltipNumbers(rtlChart);
  const rtlDates = await readRightToLeftWords(rtlChart, [
    '.lovely-chart--header-caption', '.lovely-chart--tooltip-title > span:not(.lovely-chart--tooltip-title-total)',
  ]);
  await page.mouse.move(5, 5);
  const rtlYLabels = [...new Set(rtlDrawing.texts.filter(({ text }) => /^-\d/.test(text))
    .map(({ text, direction }) => `${text} ${direction}`))];
  const rtlXLabels = [...new Set(rtlDrawing.texts.filter(({ text }) => !/^-?[\d.]+K?$/.test(text))
    .map(({ text, direction }) => `${text} ${direction}`))];
  check('the right-to-left demo chart puts the signs of its Y-axis labels and tooltip numbers before the digits',
    rtlYLabels.length > 0 && rtlYLabels.every((label) => label.endsWith(' ltr'))
    && rtlTooltipNumbers.length > 0 && rtlTooltipNumbers.every(({ text, shown }) => shown === text.trim()),
    JSON.stringify({ rtlYLabels, rtlTooltipNumbers }));
  check('the right-to-left demo chart reads its Hebrew dates in order on the axis, the caption and the tooltip title',
    rtlXLabels.length > 0 && rtlXLabels.every((label) => /^\d+ ינו׳ inherit$/.test(label))
    && rtlDates.every(({ isRightToLeft }) => isRightToLeft),
    JSON.stringify({ rtlXLabels, rtlDates }));

  // --- Selection, legend callbacks and the plot height property ---
  await page.evaluate(() => {
    window.probeLog = [];
  });
  const driven = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    element.style.setProperty('--lovely-chart-plot-height', '12.5rem');
    document.getElementById('container').appendChild(element);
    window.probeChart = new LovelyChart(element, {
      type: 'bar',
      isStacked: true,
      title: 'Probe — Driven from outside',
      labels: [1, 2, 3, 4, 5].map((day) => Date.UTC(2026, 10, day)),
      datasets: [{ name: 'A', values: [1, 2, 3, 4, 5] }, { name: 'B', values: [5, 4, 3, 2, 1] }],
      onSelectedIndexChange: (index) => window.probeLog.push(['selected', index ?? 'none']),
      onHiddenSeriesChange: (names, indexes) => window.probeLog.push(['hidden', names.join(), indexes.join()]),
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    window.probeChart.selectLabel(3);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const balloon = element.querySelector('.lovely-chart--tooltip-balloon');
    const isShown = balloon.classList.contains('lovely-chart--state-shown');
    element.querySelector('.lovely-chart--button').click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      isShown,
      height: element.querySelector('canvas').clientHeight,
      remHeight: 12.5 * parseFloat(getComputedStyle(document.documentElement).fontSize),
      log: window.probeLog,
    };
  });
  check('selectLabel shows the tooltip and reports the index', driven.isShown && driven.log[0]?.[1] === 3,
    JSON.stringify(driven.log));
  check('a legend toggle reports the hidden datasets',
    JSON.stringify(driven.log.find(([kind]) => kind === 'hidden')) === JSON.stringify(['hidden', 'A', '0']),
    JSON.stringify(driven.log));
  check('the plot height follows --lovely-chart-plot-height', driven.height === driven.remHeight,
    `${driven.height}px of ${driven.remHeight}px`);

  // The pointer crossing the chart's header, outside its plot, leaves a called selection in place
  const drivenHeader = await page.locator('#probe .lovely-chart--header-title').boundingBox();
  await page.mouse.move(drivenHeader.x + 2, drivenHeader.y + drivenHeader.height / 2);
  await page.mouse.move(drivenHeader.x + 30, drivenHeader.y + drivenHeader.height / 2, { steps: 5 });
  await sleep(300);
  const heldSelection = await page.evaluate(async () => {
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const isHeld = balloon.classList.contains('lovely-chart--state-shown');
    const heldLog = window.probeLog.filter(([kind]) => kind === 'selected');
    window.probeChart.selectLabel(undefined);
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      isHeld,
      heldLog,
      isCleared: !balloon.classList.contains('lovely-chart--state-shown'),
      clearedLog: window.probeLog.filter(([kind]) => kind === 'selected'),
    };
  });
  check('a called selection holds while the pointer moves elsewhere',
    heldSelection.isHeld && JSON.stringify(heldSelection.heldLog) === '[["selected",3]]',
    JSON.stringify(heldSelection.heldLog));
  check('selectLabel(undefined) clears the selection and reports it',
    heldSelection.isCleared && JSON.stringify(heldSelection.clearedLog) === '[["selected",3],["selected","none"]]',
    JSON.stringify(heldSelection.clearedLog));
  await unmountProbe(page);

  // A callback can destroy or rebuild the chart that calls it, which then leaves alone what the callback did
  const callbackRebuilds = await page.evaluate(async ({ labels, newLabels }) => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    const buildParams = (length, onSelectedIndexChange) => ({
      type: 'bar',
      isStacked: true,
      title: 'Probe — Rebuilt by a callback',
      labels: Array.from({ length }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: [
        { name: 'A', color: '#3497ED', values: Array.from({ length }, (_, i) => 10 + (i % 4) * 10) },
        { name: 'B', color: '#F34C44', values: Array.from({ length }, (_, i) => 20 + (i % 3) * 10) },
      ],
      onSelectedIndexChange,
    });
    const readError = (act) => {
      try {
        act();
        return 'none';
      } catch (error) {
        return error.message;
      }
    };

    let chart = new LovelyChart(element, buildParams(labels, (index) => {
      if (index !== undefined) chart.destroy();
    }));
    await wait(800);
    const selectError = readError(() => chart.selectLabel(labels - 1));
    const selectChildren = element.childElementCount;

    // `update()` reports the end of the selection before it rebuilds the chart
    chart = new LovelyChart(element, buildParams(labels, (index) => {
      if (index === undefined) chart.destroy();
    }));
    await wait(800);
    chart.selectLabel(labels - 1);
    const updateError = readError(() => chart.update(buildParams(newLabels)));
    const updateChildren = element.childElementCount;

    let isUpdated = false;
    chart = new LovelyChart(element, buildParams(labels, (index) => {
      if (index === undefined || isUpdated) return;
      isUpdated = true;
      chart.update(buildParams(newLabels));
    }));
    await wait(800);
    const rebuildError = readError(() => chart.selectLabel(labels - 1));
    await wait(1200);
    const canvas = element.querySelector('.lovely-chart--container > canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let fullColorPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 0x34 && data[i + 1] === 0x97 && data[i + 2] === 0xED && data[i + 3] === 255) {
        fullColorPixels++;
      }
    }
    chart.destroy();
    element.remove();

    return {
      selectError, selectChildren, updateError, updateChildren, rebuildError, isUpdated, fullColorPixels,
    };
  }, { labels: CALLBACK_CHART_LABELS, newLabels: CALLBACK_UPDATE_LABELS });
  check('destroy() from onSelectedIndexChange of a bar chart throws nothing and leaves nothing mounted',
    callbackRebuilds.selectError === 'none' && callbackRebuilds.selectChildren === 0,
    JSON.stringify(callbackRebuilds));
  check('destroy() from the onSelectedIndexChange that update() calls stops the update',
    callbackRebuilds.updateError === 'none' && callbackRebuilds.updateChildren === 0,
    JSON.stringify(callbackRebuilds));
  check('update() from onSelectedIndexChange of a bar chart draws the new data in full colour',
    callbackRebuilds.rebuildError === 'none' && callbackRebuilds.isUpdated
    && callbackRebuilds.fullColorPixels > MIN_DATASET_PIXELS,
    JSON.stringify(callbackRebuilds));

  // The state's label range reaches one label past each edge of the window, which selectLabel must not
  const windowSelection = await page.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const element = document.createElement('div');
    element.id = 'probe';
    document.getElementById('container').appendChild(element);
    window.probeLog = [];
    const count = 101;
    window.probeChart = new LovelyChart(element, {
      type: 'line',
      title: 'Probe — Selection in the window',
      withMinimap: true,
      labels: Array.from({ length: count }, (_, i) => Date.UTC(2026, 0, 1 + i)),
      datasets: [{ name: 'A', values: Array.from({ length: count }, (_, i) => i % 7) }],
      onSelectedIndexChange: (index) => window.probeLog.push(index ?? 'none'),
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const balloon = element.querySelector('.lovely-chart--tooltip-balloon');
    // The default window is the last 20%, so its first label is 80
    window.probeChart.selectLabel(79);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const isShownBefore = balloon.classList.contains('lovely-chart--state-shown');
    window.probeChart.selectLabel(80);
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      isShownBefore,
      isShownFirst: balloon.classList.contains('lovely-chart--state-shown'),
      title: element.querySelector('.lovely-chart--tooltip-title').textContent,
      log: [...window.probeLog],
    };
  });
  check('selectLabel ignores the label before the window and takes its first',
    !windowSelection.isShownBefore && windowSelection.isShownFirst && JSON.stringify(windowSelection.log) === '[80]',
    JSON.stringify(windowSelection));

  // Panning keeps a called selection on its label until the label leaves the window
  const windowProbe = page.locator('#probe .lovely-chart--container');
  await windowProbe.scrollIntoViewIfNeeded();
  const windowMinimap = await windowProbe.locator('.lovely-chart--minimap').boundingBox();
  const readWindowSelection = () => page.evaluate(() => ({
    isShown: document.querySelector('#probe .lovely-chart--tooltip-balloon')
      .classList.contains('lovely-chart--state-shown'),
    title: document.querySelector('#probe .lovely-chart--tooltip-title').textContent,
    log: window.probeLog,
  }));
  const sliderX = windowMinimap.x + windowMinimap.width * 0.9;
  const sliderY = windowMinimap.y + windowMinimap.height / 2;
  await drag(page, sliderX, sliderY, -windowMinimap.width * 0.1, 0);
  await sleep(600);
  const panned = await readWindowSelection();
  await drag(page, sliderX - windowMinimap.width * 0.1, sliderY, -windowMinimap.width * 0.2, 0);
  await sleep(600);
  const pannedAway = await readWindowSelection();
  check('a called selection follows its label through a pan',
    panned.isShown && panned.title === windowSelection.title && JSON.stringify(panned.log) === '[80]',
    JSON.stringify(panned));
  check('a called selection clears once its label leaves the window',
    !pannedAway.isShown && JSON.stringify(pannedAway.log) === '[80,"none"]', JSON.stringify(pannedAway));
  await unmountProbe(page);

  // A balloon opened empty, or swapping narrow content for wide within one content update, sits where a pointer on
  // its label puts it: left of the newest label, inside the chart
  for (const dir of ['ltr', 'rtl']) {
    await page.evaluate((value) => document.documentElement.setAttribute('dir', value), dir);
    const edgeChart = await mountProbe(page, {
      config: {
        type: 'line',
        title: 'Probe — Balloon at the edge',
        labels: Array.from({ length: EDGE_LABEL_COUNT }, (_, i) => Date.UTC(2026, 10, 1 + i)),
        datasets: [
          { name: 'A dataset of a rather long name', values: [1, 2, 3, 4, 5, 6, 7, 1_234_567_890] },
          { name: 'Another dataset of a long name', values: [1, 2, 3, 4, 5, 6, 7, 987_654_321] },
        ],
      },
    });
    await edgeChart.scrollIntoViewIfNeeded();
    const lastIndex = EDGE_LABEL_COUNT - 1;
    const readEdgeBalloon = () => edgeChart.evaluate((el) => {
      const container = el.getBoundingClientRect();
      const balloon = el.querySelector('.lovely-chart--tooltip-balloon').getBoundingClientRect();
      // The tail runs down the tooltip canvas at the selected label
      const canvas = el.querySelector('.lovely-chart--tooltip canvas');
      const row = canvas.getContext('2d').getImageData(0, 0, canvas.width, 1).data;
      let alphaSum = 0;
      let xSum = 0;
      for (let x = 0; x < canvas.width; x++) {
        alphaSum += row[x * 4 + 3];
        xSum += row[x * 4 + 3] * (x + 0.5);
      }
      return {
        left: balloon.left - container.left,
        right: balloon.right - container.left,
        containerWidth: container.width,
        tailX: xSum / alphaSum / (canvas.width / canvas.clientWidth),
      };
    });
    await page.evaluate((index) => window.probeChart.selectLabel(index), lastIndex);
    await sleep(300);
    const calledEmpty = await readEdgeBalloon();
    await page.evaluate(async (index) => {
      window.probeChart.selectLabel(1);
      await new Promise((resolve) => setTimeout(resolve, 300));
      window.probeChart.selectLabel(2);
      window.probeChart.selectLabel(index);
    }, lastIndex);
    await sleep(300);
    const calledWider = await readEdgeBalloon();
    await page.evaluate(() => window.probeChart.selectLabel(undefined));
    const edgePlot = await edgeChart.locator('.lovely-chart--tooltip').boundingBox();
    const edgePointerY = edgePlot.y + edgePlot.height / 2;
    await page.mouse.move(edgePlot.x + calledEmpty.tailX - 40, edgePointerY, { steps: 5 });
    await page.mouse.move(edgePlot.x + calledEmpty.tailX, edgePointerY, { steps: 5 });
    await sleep(300);
    const hovered = await readEdgeBalloon();
    await page.mouse.move(0, 0);
    await unmountProbe(page);
    const isBesideLabel = ({ left, right, containerWidth }) => (
      Math.abs(left - hovered.left) <= 1 && right <= containerWidth && right <= hovered.tailX
    );
    check(`${dir}: selectLabel places a balloon at the edge as a pointer on its label does`,
      isBesideLabel(calledEmpty) && isBesideLabel(calledWider),
      JSON.stringify({ calledEmpty, calledWider, hovered }));
  }
  await page.evaluate(() => document.documentElement.removeAttribute('dir'));

  // --- Colour schemes: the `theme-dark` class on <html>, or the system scheme, each against the other ---
  // A reference line of a colour per skin shows the skin of the canvas, and `--background-color` that of the CSS
  const schemeConfig = {
    type: 'line',
    labels: [1, 2, 3, 4].map((day) => Date.UTC(2026, 10, day)),
    datasets: [{ name: 'A', color: '#3497ED', values: [1, 3, 2, 4] }],
    referenceLines: [{ value: 2.5, color: { light: '#FF00FF', dark: '#00FFFF' } }],
  };
  const readSkins = async (chart) => {
    await sleep(300);
    const day = await findColor(chart, [255, 0, 255]);
    const night = await findColor(chart, [0, 255, 255]);
    const background = await chart.evaluate((el) => (
      getComputedStyle(el).getPropertyValue('--background-color').trim().toLowerCase()
    ));
    const canvas = (day.count > 50 && !night.count && 'day') || (night.count > 50 && !day.count && 'night') || 'mixed';
    return `${canvas} canvas, ${background}`;
  };
  const setHtmlDark = (isDark) => page.evaluate((value) => {
    document.documentElement.classList.toggle('theme-dark', value);
  }, isDark);
  const wasHtmlDark = await page.evaluate(() => document.documentElement.classList.contains('theme-dark'));

  const defaultSchemeChart = await mountProbe(page, { config: { ...schemeConfig, title: 'Probe — Default scheme' } });
  await page.emulateMedia({ colorScheme: 'dark' });
  await setHtmlDark(false);
  const defaultSchemeDay = await readSkins(defaultSchemeChart);
  await page.emulateMedia({ colorScheme: 'light' });
  await setHtmlDark(true);
  const defaultSchemeNight = await readSkins(defaultSchemeChart);
  await unmountProbe(page);
  check('a chart without colorScheme follows the theme-dark class on <html>, not the system',
    defaultSchemeDay === 'day canvas, #ffffff' && defaultSchemeNight === 'night canvas, #242f3e',
    `dark system without the class: ${defaultSchemeDay}; light system with it: ${defaultSchemeNight}`);

  const classChart = await mountProbe(page, {
    config: { ...schemeConfig, title: 'Probe — HTML class name scheme', colorScheme: 'htmlClassName' },
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await setHtmlDark(false);
  const classDay = await readSkins(classChart);
  await page.emulateMedia({ colorScheme: 'light' });
  await setHtmlDark(true);
  const classNight = await readSkins(classChart);
  await unmountProbe(page);
  check('colorScheme htmlClassName follows the theme-dark class on <html>',
    classDay === 'day canvas, #ffffff' && classNight === 'night canvas, #242f3e',
    `without the class: ${classDay}; with it: ${classNight}`);

  const systemChart = await mountProbe(page, {
    config: { ...schemeConfig, title: 'Probe — System scheme', colorScheme: 'system' },
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await setHtmlDark(true);
  const systemDay = await readSkins(systemChart);
  await page.emulateMedia({ colorScheme: 'dark' });
  await setHtmlDark(false);
  const systemNight = await readSkins(systemChart);
  // Playwright restores the system scheme on `null` alone
  // eslint-disable-next-line no-null/no-null
  await page.emulateMedia({ colorScheme: null });
  await setHtmlDark(wasHtmlDark);
  await unmountProbe(page);
  check('colorScheme system follows prefers-color-scheme',
    systemDay === 'day canvas, #ffffff' && systemNight === 'night canvas, #242f3e',
    `light: ${systemDay}; dark: ${systemNight}`);

  // A zoom into a lines view keeps the chart's scheme, live
  const schemeReferenceLines = [{ value: 25, color: { light: '#FF00FF', dark: '#00FFFF' } }];
  await page.emulateMedia({ colorScheme: 'light' });
  await setHtmlDark(false);
  const systemZoom = await mountLinesZoom(page, {
    overview: [{ name: 'A', color: '#3497ED' }, { name: 'B', color: '#E65850' }],
    zoomed: [{ name: 'C', color: '#3497ED' }, { name: 'D', color: '#E65850' }, { name: 'E', color: '#9ED448' }],
    config: { colorScheme: 'system', referenceLines: schemeReferenceLines },
    zoomConfig: { referenceLines: schemeReferenceLines },
  });
  await systemZoom.scrollIntoViewIfNeeded();
  const systemZoomPlot = await systemZoom.locator('.lovely-chart--tooltip').boundingBox();
  await hoverWiggle(page, systemZoomPlot, 0.5, 0.5);
  await page.mouse.click(systemZoomPlot.x + systemZoomPlot.width / 2, systemZoomPlot.y + systemZoomPlot.height / 2);
  await sleep(2000);
  await page.mouse.move(0, 0);
  const systemZoomDay = await readSkins(systemZoom);
  await page.emulateMedia({ colorScheme: 'dark' });
  const systemZoomNight = await readSkins(systemZoom);
  const isSystemZoomLines = await systemZoom.locator('.lovely-chart--button').count() === 3;
  // eslint-disable-next-line no-null/no-null
  await page.emulateMedia({ colorScheme: null });
  await setHtmlDark(wasHtmlDark);
  await unmountProbe(page);
  check('colorScheme system follows prefers-color-scheme through a zoom into a lines view',
    isSystemZoomLines && systemZoomDay === 'day canvas, #ffffff' && systemZoomNight === 'night canvas, #242f3e',
    `light: ${systemZoomDay}; dark: ${systemZoomNight}`);

  // --- A page's night colours, under the library's own night selectors, apply ---
  const nightOverride = await mountProbe(page, {
    dataUrl: './data/steps.json',
    config: { title: 'Probe — Night override' },
  });
  const nightColors = await nightOverride.evaluate((el) => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('theme-dark');
    root.classList.add('theme-dark');
    const style = document.createElement('style');
    style.textContent = 'html.theme-dark .lovely-chart--container { --background-color: #101010; }'
      + ' html.theme-dark .lovely-chart--tooltip-balloon { box-shadow: rgb(1, 2, 3) 0px 0px 3px; }';
    document.head.appendChild(style);
    const colors = {
      background: getComputedStyle(el).getPropertyValue('--background-color').trim().toLowerCase(),
      balloonShadow: getComputedStyle(el.querySelector('.lovely-chart--tooltip-balloon')).boxShadow,
    };
    style.remove();
    root.classList.toggle('theme-dark', wasDark);
    return colors;
  });
  check('a page overrides the night colours with the library\'s night selectors',
    nightColors.background === '#101010' && nightColors.balloonShadow.includes('rgb(1, 2, 3)'),
    JSON.stringify(nightColors));
  await unmountProbe(page);

  // --- UTC labels, west of UTC ---
  const westContext = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
  const westPage = await westContext.newPage();
  await westPage.goto(url);
  const westTitles = await westPage.evaluate(async () => {
    const { default: LovelyChart } = await import('./LovelyChart.js');
    const titleAt = async (isUtc) => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      const chart = new LovelyChart(element, {
        type: 'line',
        labels: [Date.UTC(2026, 10, 17), Date.UTC(2026, 10, 18)],
        labelType: 'day',
        isUtc,
        datasets: [{ name: 'A', values: [1, 2] }],
      });
      await new Promise((resolve) => setTimeout(resolve, 800));
      chart.selectLabel(1);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const title = element.querySelector('.lovely-chart--tooltip-title').textContent;
      chart.destroy();
      element.remove();
      return title;
    };
    return { utc: await titleAt(true), local: await titleAt(false) };
  });
  await westPage.locator('.day-picker-day').nth(2).hover();
  await sleep(400);
  const westPickedDay = {
    date: await westPage.locator('.day-picker-date').nth(2).textContent(),
    title: (await westPage.locator('.lovely-chart--container').nth(DAY_PICKER_CHART)
      .locator('.lovely-chart--tooltip-title').textContent()).trim(),
  };
  await westContext.close();
  check('isUtc reads day labels in UTC', westTitles.utc === '18 Nov' && westTitles.local === '17 Nov',
    JSON.stringify(westTitles));
  check('the demo list and its chart\'s tooltip read the same day west of UTC',
    westPickedDay.date.endsWith(` ${westPickedDay.title}`), JSON.stringify(westPickedDay));

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
  await charts.nth(0).scrollIntoViewIfNeeded();
  await hoverWiggle(page, await charts.nth(0).locator('.lovely-chart--tooltip').boundingBox(), 0.45, 0.5);
  const rtlRow = await charts.nth(0).evaluate((el) => {
    const row = el.querySelector('.lovely-chart--tooltip-dataset');
    const box = (selector) => row.querySelector(selector).getBoundingClientRect();
    return {
      swatchLeft: box('.lovely-chart--tooltip-swatch').left,
      name: { left: box('.lovely-chart--dataset-title').left, right: box('.lovely-chart--dataset-title').right },
      valueRight: box('.lovely-chart--tooltip-dataset-value').right,
    };
  });
  check('an rtl tooltip row puts the swatch on the right and the value on the left',
    rtlRow.swatchLeft >= rtlRow.name.right && rtlRow.valueRight <= rtlRow.name.left, JSON.stringify(rtlRow));
  await mountProbe(page, {
    config: {
      type: 'bar', isStacked: true, labelType: 'text', labels: ['A', 'B'], isTooltipTotalInTitle: true,
      datasets: [{ name: 'Sales', values: [10, -30] }, { name: 'Fees', values: [5, 10] }],
      comparison: { name: 'Before', values: [[5, 10], [2, 5]] },
    },
  });
  // The characters of an element's text in the order they show, left to right
  await page.evaluate(() => {
    window.readVisualOrder = (element) => {
      const range = document.createRange();
      const characters = [];
      const walk = (node) => {
        if (node.nodeType !== Node.TEXT_NODE) {
          node.childNodes.forEach(walk);
          return;
        }
        for (let i = 0; i < node.length; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          if (node.data[i].trim()) characters.push([node.data[i], range.getBoundingClientRect().left]);
        }
      };
      walk(element);
      return characters.sort((a, b) => a[1] - b[1]).map(([character]) => character).join('');
    };
  });
  const rtlNumbers = await page.evaluate(async () => {
    window.probeChart.selectLabel(1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const { readVisualOrder } = window;
    return {
      comparison: readVisualOrder(balloon.querySelector(
        '.lovely-chart--tooltip-dataset-comparison .lovely-chart--tooltip-dataset-value',
      )),
      sales: readVisualOrder(balloon.querySelector('[data-name="Sales"] .lovely-chart--tooltip-dataset-value')),
      titleTotal: readVisualOrder(balloon.querySelector('.lovely-chart--tooltip-title-total')),
    };
  });
  check('an rtl tooltip puts the signs of its numbers before the digits',
    rtlNumbers.comparison === '15·-233%' && rtlNumbers.sales === '-30' && rtlNumbers.titleTotal === '-20',
    JSON.stringify(rtlNumbers));
  await unmountProbe(page);
  await mountProbe(page, {
    config: {
      type: 'bar', isPercentage: true, isStacked: true, labelType: 'text', labels: ['A', 'B'],
      datasets: [
        { name: 'Gains', values: [50, 50] }, { name: 'Losses', values: [-10, -10] }, { name: 'Flat', values: [7, 7] },
      ],
    },
  });
  const rtlColumns = await page.evaluate(async () => {
    window.probeChart.selectLabel(1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const balloonLeft = balloon.getBoundingClientRect().left;
    const range = document.createRange();
    const shares = [...balloon.querySelectorAll('.lovely-chart--percentage-title')];
    return {
      valueLefts: [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset-value')]
        .map((value) => Math.round(value.getBoundingClientRect().left - balloonLeft)),
      loss: window.readVisualOrder(balloon.querySelector('[data-name="Losses"] .lovely-chart--percentage-title')),
      // Each share's text starts at the left of its box, beside the swatch
      shareInsets: shares.map((share) => {
        range.selectNodeContents(share);
        return Math.round(range.getBoundingClientRect().left - share.getBoundingClientRect().left);
      }),
    };
  });
  check('an rtl tooltip keeps its values in a column and its shares, signs first, beside their swatches',
    rtlColumns.valueLefts.length === 4 && new Set(rtlColumns.valueLefts).size === 1 && rtlColumns.loss === '-21%'
    && rtlColumns.shareInsets.length === 3 && rtlColumns.shareInsets.every((inset) => inset === 0),
    JSON.stringify(rtlColumns));
  // A chart of left-to-right direction on the right-to-left page sets its rows left to right
  const nestedColumns = await page.evaluate(async () => {
    document.getElementById('probe').dir = 'ltr';
    window.probeChart.selectLabel(1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const balloon = document.querySelector('#probe .lovely-chart--tooltip-balloon');
    const range = document.createRange();
    return {
      valueEnds: [...balloon.querySelectorAll('.lovely-chart--tooltip-dataset')].map((row) => Math.round(
        row.getBoundingClientRect().right
        - row.querySelector('.lovely-chart--tooltip-dataset-value').getBoundingClientRect().right,
      )),
      // Each share's text ends at the right of its box, beside the swatch
      shareInsets: [...balloon.querySelectorAll('.lovely-chart--percentage-title')].map((share) => {
        range.selectNodeContents(share);
        return Math.round(share.getBoundingClientRect().right - range.getBoundingClientRect().right);
      }),
    };
  });
  check('an ltr chart on an rtl page keeps its values in a column at the end of its rows, its shares by their swatches',
    nestedColumns.valueEnds.length === 4 && nestedColumns.valueEnds.every((end) => end === 0)
    && nestedColumns.shareInsets.length === 3 && nestedColumns.shareInsets.every((inset) => inset === 0),
    JSON.stringify(nestedColumns));
  await unmountProbe(page);
  await page.evaluate(() => document.documentElement.removeAttribute('dir'));
  await sleep(300);

  // --- Theme switch (MutationObserver -> state update path) ---
  await page.locator('#skin-switcher').click();
  await sleep(800);
  check('theme switch repaints without errors', (await paintedPixels(page, 0)) > 1000);

  // --- Resize (debounced destroy-and-recreate path) ---
  // The probe's element follows the viewport width, so the rebuild narrows the plot area
  const resizedAreaChart = await mountProbe(page, {
    config: { ...areaConfig, title: 'Probe — Plot area resize' },
    hostStyle: `${PADDED_HOST_STYLE}; width: 40vw`,
  });
  await resizedAreaChart.scrollIntoViewIfNeeded();
  await addPlotAreaOverlay(page);
  const wideAreaFit = await readPlotAreaFit(page, ['#FF0000']);
  await page.setViewportSize({ width: 700, height: 1200 });
  await sleep(1200);
  const narrowAreaFit = await readPlotAreaFit(page, ['#FF0000']);
  await unmountProbe(page);
  check('a rebuild on resize narrows the plot area with the plot',
    isFramedBy(narrowAreaFit.overlay, narrowAreaFit.boxes[0])
    && narrowAreaFit.overlay.right < wideAreaFit.overlay.right - 50,
    `overlay ${formatBox(narrowAreaFit.overlay)} after ${formatBox(wideAreaFit.overlay)}, `
    + `line ${formatBox(narrowAreaFit.boxes[0])}`);

  const countAfterResize = await page.locator('.lovely-chart--container').count();
  const paintedAfterResize = await paintedPixels(page, 0);
  check('resize redraw keeps all charts alive', countAfterResize === EXPECTED_CHARTS && paintedAfterResize > 1000,
    `charts: ${countAfterResize}, painted: ${paintedAfterResize}px`);

  await page.setViewportSize({ width: PHONE_WIDTH, height: 812 });
  await sleep(1200);
  const phoneWidths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  check('the demo page fits a phone without scrolling sideways', phoneWidths.scroll <= phoneWidths.client,
    JSON.stringify(phoneWidths));
  const phoneForecastLabel = await page.locator('.forecast-band').evaluate((band) => {
    const range = document.createRange();
    range.selectNodeContents(band);
    const text = range.getBoundingClientRect();
    const { left, right } = band.getBoundingClientRect();
    return { band: [left, right], text: [text.left, text.right], isInside: text.left >= left && text.right <= right };
  });
  check('the demo forecast band holds its label on a phone', phoneForecastLabel.isInside,
    JSON.stringify(phoneForecastLabel));

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
