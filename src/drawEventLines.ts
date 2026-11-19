import type { Projection } from './Projection.js';
import type { AnalyzedData, ChartColors, EventLine } from './types.js';

import { drawDashedRule, drawHalo } from './canvas.js';
import { getIntervalPosition } from './formulas.js';
import { getCssColor, pickSkinColor } from './skin.js';

const LABEL_FONT_WEIGHT = 500;
// The space between a label and its rule, and between two labels
const LABEL_GAP = 4;
const LABEL_INSET_TOP = 2;
const QUARTER_TURN = Math.PI / 2;

interface PlacedLabel {
  text: string;
  color: string;
  lineX: number;
  start: number;
}

// The rules rise from the bottom of the Y range through the room above it to the top of the canvas
export function drawEventLines(
  context: CanvasRenderingContext2D, data: AnalyzedData, projection: Projection, colors: ChartColors,
) {
  const { top, height } = projection.getArea();
  data.eventLines.forEach((line) => {
    drawDashedRule(context, getLineX(data, projection, line), 0, top + height, getLineColor(colors, line));
  });
}

// A label reads bottom to top from the top of its rule, before the rule, or after it where it would cover the Y-axis
// labels or leave the plot area. It is dropped where it fits on neither side or runs longer than its rule, and where
// the label of a later rule crowds it.
export function drawEventLineLabels(
  context: CanvasRenderingContext2D, data: AnalyzedData, projection: Projection, colors: ChartColors,
  [startReserve, endReserve]: [number, number],
) {
  const area = projection.getArea();
  const thickness = data.axisFontSize;
  const roomStart = area.left + startReserve;
  const roomEnd = area.left + area.width - endReserve;
  const maxWidth = area.top + area.height - LABEL_INSET_TOP;
  const fontFamily = getComputedStyle(context.canvas).fontFamily || 'sans-serif';
  const background = getCssColor(colors, 'background');

  context.save();
  context.font = `${LABEL_FONT_WEIGHT} ${thickness}px ${fontFamily}`;
  context.textAlign = 'right';
  context.textBaseline = 'top';
  const placed: PlacedLabel[] = [];
  data.eventLines
    .flatMap((line) => {
      if (!line.label || context.measureText(line.label).width > maxWidth) return [];

      const lineX = getLineX(data, projection, line);
      const start = [lineX - LABEL_GAP - thickness, lineX + LABEL_GAP]
        .find((side) => side >= roomStart && side + thickness <= roomEnd);
      return start !== undefined ? [{ text: line.label, color: getLineColor(colors, line), lineX, start }] : [];
    })
    .sort((a, b) => b.lineX - a.lineX)
    .forEach((label) => {
      if (placed.some(({ start }) => Math.abs(start - label.start) < thickness + LABEL_GAP)) return;

      placed.push(label);
    });
  placed.forEach(({ text, color, start }) => {
    context.save();
    context.translate(start, LABEL_INSET_TOP);
    context.rotate(-QUARTER_TURN);
    drawHalo(context, text, 0, 0, background);
    context.fillStyle = color;
    context.fillText(text, 0, 0);
    context.restore();
  });
  context.restore();
}

function getLineX(data: AnalyzedData, projection: Projection, { labelIndex, offset }: EventLine): number {
  return projection.toPixels(getIntervalPosition(data, labelIndex, offset), 0)[0];
}

function getLineColor(colors: ChartColors, { color }: EventLine): string {
  return color !== undefined ? pickSkinColor(colors, color) : getCssColor(colors, 'y-axis-text');
}
