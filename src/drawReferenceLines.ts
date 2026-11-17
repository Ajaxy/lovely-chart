import type { Projection } from './Projection.js';
import type { AnalyzedData, ChartColors, Size } from './types.js';

import { drawHalo } from './canvas.js';
import {
  GUTTER,
  PLOT_TOP_PADDING,
  REFERENCE_LABEL_FONT_STYLE,
  REFERENCE_LINE_DASH,
  REFERENCE_LINE_WIDTH,
  SPARKLINE_PADDING,
} from './constants.js';
import { getPlotStart } from './formulas.js';
import { getCssColor, pickSkinColor } from './skin.js';

const TRANSPARENT = 'transparent';
const PERCENT_MAX = 100;

export function drawReferenceLines(
  context: CanvasRenderingContext2D,
  data: AnalyzedData,
  projection: Projection,
  plotSize: Size,
  colors: ChartColors,
  labelColumnWidth: number | undefined,
) {
  const lineStart = data.isSparkline ? SPARKLINE_PADDING : getPlotStart(labelColumnWidth);
  const lineEnd = plotSize.width - (data.isSparkline ? SPARKLINE_PADDING : GUTTER);
  const fontFamily = getComputedStyle(context.canvas).fontFamily || 'sans-serif';

  data.referenceLines.forEach(({ value, label, color }) => {
    const stroke = color !== undefined ? pickSkinColor(color) : getCssColor(colors, 'y-axis-text');
    if (stroke.toLowerCase() === TRANSPARENT) return;

    const yPx = getReferenceY(data, projection, value);
    if (yPx === undefined) return;

    context.save();
    context.strokeStyle = stroke;
    context.lineWidth = REFERENCE_LINE_WIDTH;
    context.setLineDash(REFERENCE_LINE_DASH);
    context.beginPath();
    context.moveTo(lineStart, yPx);
    context.lineTo(lineEnd, yPx);
    context.stroke();
    context.setLineDash([]);

    if (label) {
      const labelY = yPx - GUTTER / 2;
      context.font = `${REFERENCE_LABEL_FONT_STYLE} ${fontFamily}`;
      context.textAlign = 'right';
      context.textBaseline = 'bottom';
      drawHalo(context, label, lineEnd, labelY, getCssColor(colors, 'background'));
      context.fillStyle = stroke;
      context.fillText(label, lineEnd, labelY);
    }

    context.restore();
  });
}

// A percentage chart places its lines on the percentage grid of the axis, from its bottom to its top
function getReferenceY(data: AnalyzedData, projection: Projection, value: number): number | undefined {
  if (!data.isPercentage) {
    return projection.toPixels(0, value)[1];
  }

  if (value < 0 || value > PERCENT_MAX) return undefined;

  const [, height] = projection.getSize();
  return height - height * (value / PERCENT_MAX) + PLOT_TOP_PADDING;
}
