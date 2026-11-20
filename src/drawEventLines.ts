import type { Projection } from './Projection.js';
import type { AnalyzedData, ChartColors, EventLine } from './types.js';

import { drawHalo, drawRule, snapToPixel } from './canvas.js';
import { LINE_DASHES } from './constants.js';
import { getIntervalPosition } from './formulas.js';
import { getCssColor, pickSkinColor } from './skin.js';

const LABEL_FONT_WEIGHT = 500;
// The space between a label and its rule, and between two labels
const LABEL_GAP = 4;
const LABEL_INSET_TOP = 2;
const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;
const NO_DASH: number[] = [];
const HEAD_RADIUS = 4;
const HEAD_RING_WIDTH = 1.5;
// A head rests on the top of the canvas, and the label of its rule starts under it
const HEAD_CENTER_Y = HEAD_RADIUS + HEAD_RING_WIDTH;
const HEAD_LABEL_INSET_TOP = HEAD_CENTER_Y * 2 + LABEL_INSET_TOP;

interface PlacedLabel {
  text: string;
  color: string;
  lineX: number;
  start: number;
  top: number;
}

// The rules rise from the bottom of the Y range through the room above it to the top of the canvas
export function drawEventLines(
  context: CanvasRenderingContext2D, data: AnalyzedData, projection: Projection, colors: ChartColors,
) {
  const { top, height } = projection.getArea();
  data.eventLines.forEach((line) => {
    drawRule(context, getLineX(data, projection, line), 0, top + height, getLineColor(colors, line), getLineDash(line));
  });
}

// A label reads bottom to top from the top of its rule or from under its head, before the rule, or after it where it
// would cover the Y-axis labels or leave the plot area. It is dropped where it fits on neither side or runs longer than
// its rule, and where the label of a later rule crowds it.
export function drawEventLineLabels(
  context: CanvasRenderingContext2D, data: AnalyzedData, projection: Projection, colors: ChartColors,
  [startReserve, endReserve]: [number, number],
) {
  const area = projection.getArea();
  const thickness = data.axisFontSize;
  const roomStart = area.left + startReserve;
  const roomEnd = area.left + area.width - endReserve;
  const fontFamily = getComputedStyle(context.canvas).fontFamily || 'sans-serif';
  const background = getCssColor(colors, 'background');

  context.save();
  context.font = `${LABEL_FONT_WEIGHT} ${thickness}px ${fontFamily}`;
  context.textAlign = 'right';
  context.textBaseline = 'top';
  const placed: PlacedLabel[] = [];
  data.eventLines
    .flatMap((line) => {
      const top = line.withHead ? HEAD_LABEL_INSET_TOP : LABEL_INSET_TOP;
      if (!line.label || context.measureText(line.label).width > area.top + area.height - top) return [];

      const lineX = getLineX(data, projection, line);
      const start = [lineX - LABEL_GAP - thickness, lineX + LABEL_GAP]
        .find((side) => side >= roomStart && side + thickness <= roomEnd);
      return start !== undefined ? [{ text: line.label, color: getLineColor(colors, line), lineX, start, top }] : [];
    })
    .sort((a, b) => b.lineX - a.lineX)
    .forEach((label) => {
      if (placed.some(({ start }) => Math.abs(start - label.start) < thickness + LABEL_GAP)) return;

      placed.push(label);
    });
  placed.forEach(({ text, color, start, top }) => {
    context.save();
    context.translate(start, top);
    context.rotate(-QUARTER_TURN);
    drawHalo(context, text, 0, 0, background);
    context.fillStyle = color;
    context.fillText(text, 0, 0);
    context.restore();
  });
  context.restore();
}

export function drawEventLineHeads(
  context: CanvasRenderingContext2D, data: AnalyzedData, projection: Projection, colors: ChartColors,
) {
  const background = getCssColor(colors, 'background');
  data.eventLines
    .filter(({ withHead }) => withHead)
    .forEach((line) => {
      drawHead(context, getLineX(data, projection, line), getLineColor(colors, line), background);
    });
}

function getLineX(data: AnalyzedData, projection: Projection, { labelIndex, offset }: EventLine): number {
  return projection.toPixels(getIntervalPosition(data, labelIndex, offset), 0)[0];
}

function getLineColor(colors: ChartColors, { color }: EventLine): string {
  return color !== undefined ? pickSkinColor(colors, color) : getCssColor(colors, 'y-axis-text');
}

function getLineDash({ isDashed, isDotted }: EventLine): number[] {
  if (isDotted) return LINE_DASHES.dotted;
  return isDashed ? LINE_DASHES.dashed : NO_DASH;
}

// The ring of the background colour sets the head apart from the data and the labels under it
function drawHead(context: CanvasRenderingContext2D, x: number, color: string, background: string) {
  const centerX = snapToPixel(x);
  context.save();
  context.fillStyle = background;
  context.beginPath();
  context.arc(centerX, HEAD_CENTER_Y, HEAD_RADIUS + HEAD_RING_WIDTH, 0, FULL_TURN);
  context.fill();
  context.fillStyle = color;
  context.beginPath();
  context.arc(centerX, HEAD_CENTER_Y, HEAD_RADIUS, 0, FULL_TURN);
  context.fill();
  context.restore();
}
