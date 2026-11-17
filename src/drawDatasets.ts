import type { Projection } from './Projection.js';
import type { AnalyzedData, ChartColors, ChartState, ChartType, DrawPoint, LabelRange, Pixel, Point } from './types.js';

import {
  CIRCLE_MINIMUM_VISIBLE_PERCENT, DONUT_INNER_RADIUS_FACTOR, NO_FOCUS, PLOT_BARS_WIDTH_SHIFT, PLOT_CIRCLE_SHIFT,
} from './constants.js';
import { getCircleRadius, getCircleTextShift, getCircleTextSize, isConstantRange } from './formulas.js';
import { simplify } from './simplify.js';
import { getCssColor } from './skin.js';

const MARKED_SEGMENT_POINTS = 3;
const MARK_RADIUS_FACTOR = 1.5;

interface DrawOptions {
  color: string;
  lineWidth: number;
  opacity: number;
  simplification: number;
  center?: Pixel;
  radius?: number;
  shift?: number;
  isDonut?: boolean;
  withGradient?: boolean;
  focusOn?: number;
}

interface MaskOptions {
  focusOn: number;
  color: string;
  lineWidth: number;
}

export function drawDatasets(
  context: CanvasRenderingContext2D, state: ChartState, data: AnalyzedData,
  range: LabelRange, points: Point[][], projection: Projection,
  secondaryPoints: Point[] | undefined, secondaryProjection: Projection | undefined,
  lineWidth: number, visibilities: number[], colors: ChartColors, shouldConvertToBars: boolean, simplification: number,
) {
  // A label where a visible stacked dataset has no value leaves every area stacked above it without a base.
  // A percentage chart keeps that base, the shares of the values the label has.
  const isMissingInStack: boolean[] = [];

  data.datasets.forEach(({ key, type, hasOwnYAxis }, i) => {
    if (!visibilities[i]) {
      return;
    }

    const options: DrawOptions = {
      color: getCssColor(colors, `dataset#${key}`),
      lineWidth,
      opacity: data.isStacked || data.isShares ? 1 : visibilities[i],
      simplification,
    };

    const datasetType = (type === 'pie' || type === 'donut') && shouldConvertToBars ? 'bar' : type;
    const datasetPoints: DrawPoint[] = hasOwnYAxis ? secondaryPoints! : points[i];
    const datasetProjection = hasOwnYAxis ? secondaryProjection! : projection;

    if (datasetType === 'area') {
      if (data.isStacked && !data.isShares) {
        datasetPoints.forEach(({ isGap }, j) => {
          isMissingInStack[j] ||= Boolean(isGap);
        });
      }

      drawAreaSegments(context, datasetPoints, isMissingInStack, datasetProjection, options);
      return;
    }

    if (datasetType === 'pie' || datasetType === 'donut') {
      options.center = projection.getCenter();
      options.radius = getCircleRadius(projection);
      options.shift = (state[`circleShift#${key}`] || 0) * PLOT_CIRCLE_SHIFT;
      options.isDonut = data.isDonut;
      options.withGradient = data.withGradient;
    }

    if (datasetType === 'bar') {
      const [x0] = projection.toPixels(0, 0);
      const [x1] = projection.toPixels(1, 0);

      options.lineWidth = x1 - x0;
      options.focusOn = state.focusOn as number;
    }

    drawDataset(datasetType, context, datasetPoints, datasetProjection, options);
  });

  if (state.focusOn !== undefined && state.focusOn !== NO_FOCUS && (data.isBars || data.isSteps)) {
    const [x0] = projection.toPixels(0, 0);
    const [x1] = projection.toPixels(1, 0);

    drawBarsMask(context, projection, {
      focusOn: state.focusOn as number,
      color: getCssColor(colors, 'mask'),
      lineWidth: data.isSteps ? x1 - x0 + lineWidth : x1 - x0,
    });
  }
}

function drawDataset(
  type: ChartType,
  context: CanvasRenderingContext2D,
  points: DrawPoint[],
  projection: Projection,
  options: DrawOptions,
) {
  switch (type) {
    case 'line':
      return drawDatasetLine(context, points, projection, options);
    case 'bar':
      return drawDatasetBars(context, points, projection, options);
    case 'step':
      return drawDatasetSteps(context, points, projection, options);
    case 'area':
      return drawDatasetArea(context, points, projection, options);
    case 'pie':
    case 'donut':
      return drawDatasetCircle(context, points, projection, options);
  }
}

function drawDatasetLine(
  context: CanvasRenderingContext2D, points: DrawPoint[], projection: Projection, options: DrawOptions,
) {
  context.beginPath();

  const segments: Pixel[][] = [];
  let current: Pixel[] = [];
  for (let j = 0, l = points.length; j < l; j++) {
    const point = points[j];
    if (point.isGap) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    current.push(projection.toPixels(point.labelIndex, point.stackValue));
  }
  if (current.length) segments.push(current);

  segments.forEach((segment) => {
    let pixels = segment;
    if (options.simplification) {
      pixels = simplify(pixels)(options.simplification).points;
    }
    pixels.forEach(([x, y], k) => {
      if (k === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
  });

  context.save();
  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'bevel';
  context.lineCap = 'butt';
  context.stroke();

  // A run this short between gaps reads as a stray stroke, or draws nothing at all, so each point carries a dot
  const markedPixels = segments.filter((segment) => segment.length < MARKED_SEGMENT_POINTS).flat();
  if (markedPixels.length) {
    const radius = options.lineWidth * MARK_RADIUS_FACTOR;
    context.beginPath();
    markedPixels.forEach(([x, y]) => {
      context.moveTo(x + radius, y);
      context.arc(x, y, radius, 0, Math.PI * 2);
    });
    context.fillStyle = options.color;
    context.fill();
  }

  context.restore();
}

function drawDatasetBars(
  context: CanvasRenderingContext2D, points: DrawPoint[], projection: Projection, options: DrawOptions,
) {
  const fillProjection = getFillProjection(projection);
  const { yMin } = fillProjection.getParams();

  context.save();
  context.globalAlpha = options.opacity;
  context.fillStyle = options.color;

  for (let j = 0, l = points.length; j < l; j++) {
    if (points[j].isGap) continue;
    const { labelIndex, stackValue, stackOffset = 0 } = points[j];

    const [, yFrom] = fillProjection.toPixels(labelIndex, Math.max(stackOffset, yMin));
    const [x, yTo] = fillProjection.toPixels(labelIndex, stackValue);
    const rectX = x - options.lineWidth / 2;
    const rectY = yTo;
    const rectW = options.opacity === 1
      ? options.lineWidth + PLOT_BARS_WIDTH_SHIFT
      : options.lineWidth + PLOT_BARS_WIDTH_SHIFT * options.opacity;
    const rectH = yFrom - yTo;

    context.fillRect(rectX, rectY, rectW, rectH);
  }

  context.restore();
}

// A constant range puts its value at the middle height, so bars and areas project over a range from zero to twice that
// value: a positive fill rises from the plot bottom to the middle and a negative one hangs from the plot top
function getFillProjection(projection: Projection): Projection {
  const { yMin, yMax } = projection.getParams();
  if (!isConstantRange(yMin, yMax)) {
    return projection;
  }

  return projection.copy({ yMin: Math.min(0, yMin * 2), yMax: Math.max(0, yMin * 2) });
}

function drawDatasetSteps(
  context: CanvasRenderingContext2D, points: DrawPoint[], projection: Projection, options: DrawOptions,
) {
  context.beginPath();

  const segments: Pixel[][] = [];
  let current: Pixel[] = [];
  for (let j = 0, l = points.length; j < l; j++) {
    const point = points[j];
    if (point.isGap) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    current.push(
      projection.toPixels(point.labelIndex - PLOT_BARS_WIDTH_SHIFT, point.stackValue),
      projection.toPixels(point.labelIndex + PLOT_BARS_WIDTH_SHIFT, point.stackValue),
    );
  }
  if (current.length) segments.push(current);

  segments.forEach((segment) => {
    segment.forEach(([x, y], k) => {
      if (k === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
  });

  context.save();
  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.stroke();
  context.restore();
}

function drawBarsMask(context: CanvasRenderingContext2D, projection: Projection, options: MaskOptions) {
  const [xCenter, yCenter] = projection.getCenter();
  const [width, height] = projection.getSize();

  const [x] = projection.toPixels(options.focusOn, 0);

  context.fillStyle = options.color;
  context.fillRect(
    xCenter - width / 2, yCenter - height / 2, x - options.lineWidth / 2 + PLOT_BARS_WIDTH_SHIFT, height,
  );
  context.fillRect(x + options.lineWidth / 2, yCenter - height / 2, width - (x + options.lineWidth / 2), height);
}

// Each run of known values fills down to its own stack base, and a lone value draws as a dot
function drawAreaSegments(
  context: CanvasRenderingContext2D, points: DrawPoint[], isMissingInStack: boolean[],
  projection: Projection, options: DrawOptions,
) {
  const segments: DrawPoint[][] = [];
  let current: DrawPoint[] = [];
  points.forEach((point, j) => {
    if (point.isGap || isMissingInStack[j]) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      return;
    }
    current.push(point);
  });
  if (current.length) segments.push(current);

  segments.forEach((segment) => {
    if (segment.length === 1) {
      drawDatasetLine(context, segment, projection, options);
      return;
    }

    const lowerBoundary = segment.map(({ labelIndex, stackOffset = 0 }) => ({ labelIndex, stackValue: stackOffset }));
    drawDatasetArea(context, [...lowerBoundary, ...segment.slice().reverse()], getFillProjection(projection), options);
  });
}

function drawDatasetArea(
  context: CanvasRenderingContext2D, points: DrawPoint[], projection: Projection, options: DrawOptions,
) {
  context.beginPath();

  let pixels: Pixel[] = [];

  for (let j = 0, l = points.length; j < l; j++) {
    const { labelIndex, stackValue } = points[j];
    pixels.push(projection.toPixels(labelIndex, stackValue));
  }

  if (options.simplification) {
    const simplifierFn = simplify(pixels);
    pixels = simplifierFn(options.simplification).points;
  }

  pixels.forEach(([x, y]) => {
    context.lineTo(x, y);
  });

  context.save();
  context.fillStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'bevel';
  context.lineCap = 'butt';
  context.fill();
  context.restore();
}

function drawDatasetCircle(
  context: CanvasRenderingContext2D, points: DrawPoint[], projection: Projection, options: DrawOptions,
) {
  const { visibleValue, stackValue, stackOffset = 0 } = points[0];

  if (!visibleValue) {
    return;
  }

  const { yMin, yMax } = projection.getParams();
  const percentFactor = 1 / (yMax - yMin);
  const percent = visibleValue * percentFactor;

  const beginAngle = stackOffset * percentFactor * Math.PI * 2 - Math.PI / 2;
  const endAngle = stackValue * percentFactor * Math.PI * 2 - Math.PI / 2;

  const { radius = 120, center: [x, y] = [0, 0], shift = 0, isDonut, withGradient } = options;
  const innerRadius = isDonut ? radius * DONUT_INNER_RADIUS_FACTOR : 0;

  const shiftAngle = (beginAngle + endAngle) / 2;
  const directionX = Math.cos(shiftAngle);
  const directionY = Math.sin(shiftAngle);
  const shiftX = directionX * shift;
  const shiftY = directionY * shift;

  context.save();

  context.beginPath();
  // `withGradient` adds slight concentric shading for depth: lighter at the
  // inner edge (center for a plain pie), darker toward the outer edge
  context.fillStyle = withGradient
    ? buildCircleGradient(context, x + shiftX, y + shiftY, innerRadius, radius, options.color)
    : options.color;
  if (isDonut) {
    context.arc(x + shiftX, y + shiftY, radius, beginAngle, endAngle);
    context.arc(x + shiftX, y + shiftY, innerRadius, endAngle, beginAngle, true);
    context.closePath();
  } else {
    context.moveTo(x + shiftX, y + shiftY);
    context.arc(x + shiftX, y + shiftY, radius, beginAngle, endAngle);
    context.lineTo(x + shiftX, y + shiftY);
  }
  context.fill();

  if (percent >= CIRCLE_MINIMUM_VISIBLE_PERCENT) {
    const fontFamily = getComputedStyle(context.canvas).fontFamily || 'sans-serif';
    context.font = `700 ${getCircleTextSize(percent, radius)}px ${fontFamily}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'white';
    const textShift = isDonut ? (radius + innerRadius) / 2 : getCircleTextShift(percent, radius);
    context.fillText(
      `${Math.round(percent * 100)}%`, x + directionX * textShift + shiftX, y + directionY * textShift + shiftY,
    );
  }

  context.restore();
}

function buildCircleGradient(
  context: CanvasRenderingContext2D, cx: number, cy: number, innerRadius: number, radius: number, color: string,
) {
  const channels = parseRgba(color);
  const gradient = context.createRadialGradient(cx, cy, innerRadius, cx, cy, radius);
  gradient.addColorStop(0, shadeColor(channels, 0.1));
  gradient.addColorStop(1, shadeColor(channels, -0.1));
  return gradient;
}

function parseRgba(color: string): number[] {
  const channels = color.match(/[\d.]+/g);
  return channels ? channels.map(Number) : [0, 0, 0, 1];
}

// `amount` > 0 mixes toward white (highlight), < 0 toward black (shadow)
function shadeColor([r, g, b, a = 1]: number[], amount: number): string {
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (channel: number) => Math.round(channel + (target - channel) * t);
  return `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${a})`;
}
