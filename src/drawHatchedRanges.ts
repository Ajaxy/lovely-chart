import type { Projection } from './Projection.js';
import type { AnalyzedData, ChartColors, HatchedRange } from './types.js';

import { drawHalo } from './canvas.js';
import { REFERENCE_LINE_DASH } from './constants.js';
import { getCssColor, pickSkinColor } from './skin.js';

const STRIPE_WIDTH = 2;
// The stripes rise to the right, `STRIPE_PERIOD` apart measured across them as a `135deg` repeating gradient measures
// it, so `STRIPE_PERIOD`·√2 apart along a row
const STRIPE_PERIOD = 8;
const STRIPE_X_STEP = STRIPE_PERIOD * Math.SQRT2;
const UNDER_LINES_OPACITY = 0.14;
const OVER_FILLS_OPACITY = 0.28;
const EDGE_WIDTH = 1;
const HALF_PIXEL = 0.5;
const HALF_LABEL = 0.5;
const LABEL_FONT_WEIGHT = 500;
const LABEL_INSET_X = 4;
const LABEL_INSET_Y = 6;

interface Band {
  start: number;
  end: number;
  color: string;
}

// Touching ranges of one colour hatch as one band, and the stripes of every band keep the phase of the first label, so
// they move with the data as the window pans
export function drawHatchedRanges(
  context: CanvasRenderingContext2D, data: AnalyzedData, projection: Projection, colors: ChartColors, hasEdges: boolean,
) {
  const { top, height } = projection.getArea();
  const [canvasWidth] = projection.getSize();
  const bottom = top + height;
  const [anchorX] = projection.toPixels(0, 0);
  const bands = mergeBands(data.hatchedRanges.map((range) => {
    const [start, end] = getSpan(range, projection);
    return { start, end, color: getRangeColor(colors, range) };
  }));

  context.save();
  context.lineWidth = STRIPE_WIDTH;
  context.globalAlpha = areHatchesOverFills(data) ? OVER_FILLS_OPACITY : UNDER_LINES_OPACITY;
  bands.forEach(({ start, end, color }) => {
    // A zoom into one label stretches a long band far past the canvas, which would cost a stripe per step of it
    const left = Math.max(projection.toPixels(start, 0)[0], 0);
    const right = Math.min(projection.toPixels(end, 0)[0], canvasWidth);
    if (left >= right) return;

    context.save();
    context.beginPath();
    context.rect(left, top, right - left, height);
    context.clip();
    context.beginPath();
    const firstX = anchorX + Math.floor((left - height - anchorX) / STRIPE_X_STEP) * STRIPE_X_STEP;
    for (let x = firstX; x < right; x += STRIPE_X_STEP) {
      context.moveTo(x, bottom);
      context.lineTo(x + height, top);
    }
    context.strokeStyle = color;
    context.stroke();
    context.restore();
  });
  context.restore();

  if (hasEdges) {
    drawEdges(context, data, projection, colors, top, bottom);
  }
}

// A span that starts at the first label has nothing before it to set apart
function drawEdges(
  context: CanvasRenderingContext2D, data: AnalyzedData, projection: Projection, colors: ChartColors,
  top: number, bottom: number,
) {
  const firstStart = projection.hasColumns() ? -HALF_LABEL : 0;

  context.save();
  context.lineWidth = EDGE_WIDTH;
  context.setLineDash(REFERENCE_LINE_DASH);
  data.hatchedRanges.forEach((range) => {
    const [start] = getSpan(range, projection);
    if (!range.hasEdge || start <= firstStart) return;

    const x = Math.round(projection.toPixels(start, 0)[0]) + HALF_PIXEL;
    context.strokeStyle = getRangeColor(colors, range);
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, bottom);
    context.stroke();
  });
  context.restore();
}

// Each label stays inside the part of its range's span within the plot area, clear of the Y-axis labels on its row and
// of the next label, so it follows a range panned partly out of view and is dropped where it has no room
export function drawHatchedRangeLabels(
  context: CanvasRenderingContext2D, data: AnalyzedData, projection: Projection, colors: ChartColors,
  [startReserve, endReserve]: [number, number],
) {
  const area = projection.getArea();
  const roomStart = area.left + startReserve;
  const roomEnd = area.left + area.width - endReserve;
  const y = area.top + area.height - LABEL_INSET_Y;
  const fontFamily = getComputedStyle(context.canvas).fontFamily || 'sans-serif';
  const background = getCssColor(colors, 'background');
  const placed = data.hatchedRanges
    .flatMap((range) => {
      if (!range.label) return [];

      const [start, end] = getSpan(range, projection);
      const x = Math.max(projection.toPixels(start, 0)[0], roomStart) + LABEL_INSET_X;
      const xEnd = Math.min(projection.toPixels(end, 0)[0], roomEnd) - LABEL_INSET_X;
      return [{ range, label: range.label, x, xEnd }];
    })
    .sort((a, b) => a.x - b.x);

  context.save();
  context.font = `${LABEL_FONT_WEIGHT} ${data.axisFontSize}px ${fontFamily}`;
  context.textAlign = 'left';
  context.textBaseline = 'bottom';
  placed.forEach(({ range, label, x, xEnd }, i) => {
    const next = placed[i + 1];
    const limit = next ? Math.min(xEnd, next.x - LABEL_INSET_X) : xEnd;
    if (context.measureText(label).width > limit - x) return;

    drawHalo(context, label, x, y, background);
    context.fillStyle = getRangeColor(colors, range);
    context.fillText(label, x, y);
  });
  context.restore();
}

// A line or area span is clamped to the points of the line, as nothing is drawn beyond them
function getSpan({ from, to, isAccruing }: HatchedRange, projection: Projection): [number, number] {
  if (projection.hasColumns()) {
    return [from - HALF_LABEL, to + HALF_LABEL];
  }

  const { lastLabelIndex } = projection.getParams();
  return [Math.max(0, from - (isAccruing ? HALF_LABEL : 1)), Math.min(lastLabelIndex, to + HALF_LABEL)];
}

function getRangeColor(colors: ChartColors, { color }: HatchedRange): string {
  return color !== undefined ? pickSkinColor(colors, color) : getCssColor(colors, 'y-axis-text');
}

function mergeBands(bands: Band[]): Band[] {
  const merged: Band[] = [];
  const lastByColor = new Map<string, Band>();
  [...bands].sort((a, b) => a.start - b.start).forEach((band) => {
    const previous = lastByColor.get(band.color);
    if (previous && band.start <= previous.end) {
      previous.end = Math.max(previous.end, band.end);
      return;
    }

    const copy = { ...band };
    merged.push(copy);
    lastByColor.set(band.color, copy);
  });

  return merged;
}

// A hatch under a fill would vanish, and one over lines would dim them, so over fills it takes the tone that still shows
function areHatchesOverFills(data: AnalyzedData) {
  return data.hasBars || data.isAreas;
}
