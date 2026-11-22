import type { Projection } from './Projection.js';
import type {
  AnalyzedData, ChartColors, ChartState, ChartType, DrawPoint, LabelRange, Pixel, Point,
} from './types.js';

import { getComparisonValues } from './comparison.js';
import {
  CIRCLE_MINIMUM_VISIBLE_PERCENT, DONUT_INNER_RADIUS_FACTOR, GAP, LINE_DASHES, NO_FOCUS, PLOT_BARS_WIDTH_SHIFT,
  PLOT_CIRCLE_SHIFT,
} from './constants.js';
import { drawHatchedRanges } from './drawHatchedRanges.js';
import {
  getCircleRadius, getCircleTextShift, getCircleTextSize, getDrawnPattern, isConstantRange, isInTotal,
} from './formulas.js';
import { preparePoints } from './preparePoints.js';
import { simplify } from './simplify.js';
import { getContentColor, getCssColor, pickSkinColor } from './skin.js';

const MARKED_SEGMENT_POINTS = 3;
const AREA_BORDER_WIDTH = 1;
const MARK_RADIUS_FACTOR = 1.5;
const COMPARISON_LINE_WIDTH_FACTOR = 0.75;
const COMPARISON_DASH = [5, 4];
// The chords that measure each curve of a smooth line
const SMOOTH_LENGTH_SAMPLES = 64;

interface DrawOptions {
  color: string;
  lineWidth: number;
  opacity: number;
  simplification: number;
  dash?: number[];
  // The points before the drawn range, from which a dashed or dotted run that enters the range counts its pattern
  leadPoints?: DrawPoint[];
  areLinesSmooth?: boolean;
  // Every value of the line, so the ones beyond the drawn points still bend the ends of a smooth line
  seriesValues?: (number | null)[];
  areaOpacity?: number;
  areaBorderColor?: string;
  // Collects the outlines of a stack, stroked once over all its fills so a boundary two areas share draws once
  areaBorder?: Path2D;
  center?: Pixel;
  radius?: number;
  shift?: number;
  isDonut?: boolean;
  withGradient?: boolean;
  // The colour of a pie or donut sector's share, which reads on the sector as a checked legend button's label on its fill
  labelColor?: string;
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
  lineWidth: number, visibilities: number[], colors: ChartColors, isMinimap: boolean, simplification: number,
) {
  // A label where a visible stacked dataset has no value leaves every area stacked above it without a base.
  // A percentage chart keeps that base, the shares of the values the label has.
  const isMissingInStack: boolean[] = [];
  const isStack = Boolean(data.isStacked || data.isShares);
  const areaBorderColor = data.areaBorderColor !== undefined ? pickSkinColor(colors, data.areaBorderColor) : undefined;
  const areaBorder = isStack && areaBorderColor !== undefined ? new Path2D() : undefined;
  const leadRange = { from: 0, to: range.from - 1 };
  let leadPoints: Point[][] | undefined;

  function drawDatasetAt(i: number) {
    const dataset = data.datasets[i];
    if (!visibilities[i]) {
      return;
    }

    const { key, type, hasOwnYAxis, values } = dataset;
    const isInStack = isStack && isInTotal(dataset);
    const pattern = getDrawnPattern(dataset);
    const options: DrawOptions = {
      color: getCssColor(colors, `dataset#${key}`),
      lineWidth,
      opacity: isInStack ? 1 : visibilities[i],
      simplification,
      dash: pattern && LINE_DASHES[pattern],
      areLinesSmooth: data.areLinesSmooth,
      // A stack draws its sums, which the values alone do not give
      seriesValues: isInStack ? undefined : values,
      areaOpacity: data.areaOpacity,
      areaBorderColor,
      areaBorder: isInStack ? areaBorder : undefined,
    };

    const datasetType = (type === 'pie' || type === 'donut') && isMinimap ? 'bar' : type;
    const datasetPoints: DrawPoint[] = hasOwnYAxis ? secondaryPoints! : points[i];
    const datasetProjection = hasOwnYAxis ? secondaryProjection! : projection;

    if (options.dash && range.from > 0) {
      options.leadPoints = hasOwnYAxis
        ? preparePoints(data, [dataset], leadRange, visibilities, secondaryProjection!.getParams())[0]
        : (leadPoints ??= preparePoints(data, data.datasets, leadRange, visibilities, projection.getParams()))[i];
    }

    if (datasetType === 'area') {
      if (isInStack && !data.isShares) {
        datasetPoints.forEach(({ isGap }, j) => {
          isMissingInStack[j] ||= Boolean(isGap);
        });
      }

      drawAreaSegments(context, datasetPoints, isInStack ? isMissingInStack : [], datasetProjection, options);
      return;
    }

    if (datasetType === 'pie' || datasetType === 'donut') {
      options.center = projection.getCenter();
      options.radius = getCircleRadius(projection);
      options.shift = (state[`circleShift#${key}`] || 0) * PLOT_CIRCLE_SHIFT;
      options.isDonut = data.isDonut;
      options.withGradient = data.withGradient;
      options.labelColor = getContentColor(colors, `dataset#${key}`);
    }

    if (datasetType === 'bar') {
      const [x0] = projection.toPixels(0, 0);
      const [x1] = projection.toPixels(1, 0);

      options.lineWidth = x1 - x0;
      options.focusOn = state.focusOn as number;
    }

    drawDataset(datasetType, context, datasetPoints, datasetProjection, options);
  }

  // Lines and steps draw over the fills of bars and areas whatever the order of the datasets, and a hatch between them,
  // where it shows over the fills and leaves the lines clear
  const isStroked = data.datasets.map(({ type }) => type === 'line' || type === 'step');
  isStroked.forEach((isDatasetStroked, i) => {
    if (!isDatasetStroked) drawDatasetAt(i);
  });

  if (areaBorder) {
    context.save();
    context.strokeStyle = areaBorderColor!;
    context.lineWidth = AREA_BORDER_WIDTH;
    context.lineJoin = 'bevel';
    context.stroke(areaBorder);
    context.restore();
  }

  if (data.hatchedRanges.length) {
    drawHatchedRanges(context, data, projection, colors, !isMinimap);
  }

  isStroked.forEach((isDatasetStroked, i) => {
    if (isDatasetStroked) drawDatasetAt(i);
  });

  if (data.comparison) {
    const comparisonValues = getComparisonValues(data, visibilities);
    const toComparisonPoint = (value: number | null, labelIndex: number): DrawPoint => (
      { labelIndex, stackValue: value ?? 0, isGap: value === GAP }
    );
    const comparisonPoints = comparisonValues
      .slice(range.from, range.to + 1)
      .map((value, j) => toComparisonPoint(value, range.from + j));

    // The comparison line takes the shape of the line datasets it compares with
    drawDatasetLine(context, comparisonPoints, projection, {
      color: getCssColor(colors, 'dataset#comparison'),
      lineWidth: lineWidth * COMPARISON_LINE_WIDTH_FACTOR,
      opacity: 1,
      simplification,
      dash: COMPARISON_DASH,
      leadPoints: comparisonValues.slice(0, range.from).map(toComparisonPoint),
      areLinesSmooth: data.isLines && data.areLinesSmooth,
      seriesValues: comparisonValues,
    });
  }

  if (state.focusOn !== undefined && state.focusOn !== NO_FOCUS && (data.hasBars || data.hasSteps)) {
    const [x0] = projection.toPixels(0, 0);
    const [x1] = projection.toPixels(1, 0);

    drawBarsMask(context, projection, {
      focusOn: state.focusOn as number,
      color: getCssColor(colors, 'mask'),
      lineWidth: data.hasSteps ? x1 - x0 + lineWidth : x1 - x0,
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
  const segments = traceRuns(points, projection, false);

  // A run that starts or ends at the drawn range runs on to the neighbouring value outside it
  const pixelBefore = findNeighbourPixel(points[0], -1, projection, options.seriesValues);
  const pixelAfter = findNeighbourPixel(points[points.length - 1], 1, projection, options.seriesValues);

  context.save();
  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'bevel';
  context.lineCap = 'butt';
  const leadLength = measureLead(points, segments, projection, options, false);
  strokeRuns(context, segments, options.dash, leadLength, (segment, k) => {
    if (options.areLinesSmooth && segment.length > 2) {
      traceSmoothLine(
        context, segment, k === 0 ? pixelBefore : undefined, k === segments.length - 1 ? pixelAfter : undefined,
      );
      return;
    }

    let pixels = segment;
    if (options.simplification) {
      pixels = simplify(pixels)(options.simplification).points;
    }
    pixels.forEach(([x, y], j) => {
      if (j === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
  });

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

// The pixels of each run of known values between gaps: a line's at its labels, steps' at both edges of their columns
function traceRuns(points: DrawPoint[], projection: Projection, isSteps: boolean): Pixel[][] {
  const runs: Pixel[][] = [];
  let current: Pixel[] = [];
  for (let j = 0, l = points.length; j < l; j++) {
    const { labelIndex, stackValue, isGap } = points[j];
    if (isGap) {
      if (current.length) {
        runs.push(current);
        current = [];
      }
      continue;
    }
    if (isSteps) {
      current.push(
        projection.toPixels(labelIndex - PLOT_BARS_WIDTH_SHIFT, stackValue),
        projection.toPixels(labelIndex + PLOT_BARS_WIDTH_SHIFT, stackValue),
      );
    } else {
      current.push(projection.toPixels(labelIndex, stackValue));
    }
  }
  if (current.length) runs.push(current);

  return runs;
}

// The length of the path that the first run takes from its first known value before the drawn range up to the range,
// risers of steps and curves of a smooth line included
function measureLead(
  points: DrawPoint[], runs: Pixel[][], projection: Projection, options: DrawOptions, isSteps: boolean,
): number {
  const { leadPoints } = options;
  if (!options.dash || !leadPoints?.length || !runs.length || points[0].isGap) return 0;

  let start = leadPoints.length;
  while (start > 0 && !leadPoints[start - 1].isGap) start--;
  if (start === leadPoints.length) return 0;

  const [run] = runs;
  const pixels = [...traceRuns(leadPoints.slice(start), projection, isSteps)[0], run[0]];
  return !isSteps && options.areLinesSmooth && run.length > 2
    ? measureSmoothLine(pixels, getSmoothTangents(pixels, undefined, run[1]))
    : measureLine(pixels);
}

function measureLine(pixels: Pixel[]): number {
  let length = 0;
  for (let j = 1; j < pixels.length; j++) {
    length += Math.hypot(pixels[j][0] - pixels[j - 1][0], pixels[j][1] - pixels[j - 1][1]);
  }

  return length;
}

// A dashed or dotted run that enters the drawn range starts its pattern where the pattern stands after `leadLength`,
// its path before the range, so panning leaves the dashes and dots in place
function strokeRuns(
  context: CanvasRenderingContext2D, runs: Pixel[][], dash: number[] | undefined, leadLength: number,
  traceRun: (run: Pixel[], index: number) => void,
) {
  if (!dash) {
    context.beginPath();
    runs.forEach(traceRun);
    context.stroke();
    return;
  }

  const period = dash.reduce((sum, length) => sum + length, 0);
  context.setLineDash(dash);
  runs.forEach((run, index) => {
    context.beginPath();
    traceRun(run, index);
    context.lineDashOffset = index === 0 ? leadLength % period : 0;
    context.stroke();
  });
}

function findNeighbourPixel(
  point: DrawPoint | undefined, direction: number, projection: Projection, seriesValues: (number | null)[] | undefined,
): Pixel | undefined {
  if (!point || point.isGap || !seriesValues) return undefined;

  const labelIndex = point.labelIndex + direction;
  const value = seriesValues[labelIndex];
  return value === GAP || value === undefined ? undefined : projection.toPixels(labelIndex, value);
}

function traceSmoothLine(context: CanvasRenderingContext2D, pixels: Pixel[], pixelBefore?: Pixel, pixelAfter?: Pixel) {
  context.moveTo(pixels[0][0], pixels[0][1]);
  forEachCubic(pixels, getSmoothTangents(pixels, pixelBefore, pixelAfter), (_, [x1, y1], [x2, y2], [x, y]) => {
    context.bezierCurveTo(x1, y1, x2, y2, x, y);
  });
}

function measureSmoothLine(pixels: Pixel[], tangents: number[]): number {
  let length = 0;
  forEachCubic(pixels, tangents, (from, control1, control2, to) => {
    let previous = from;
    for (let j = 1; j <= SMOOTH_LENGTH_SAMPLES; j++) {
      const pixel = getCubicPixel(from, control1, control2, to, j / SMOOTH_LENGTH_SAMPLES);
      length += Math.hypot(pixel[0] - previous[0], pixel[1] - previous[1]);
      previous = pixel;
    }
  });

  return length;
}

/**
 * Harmonic-mean tangents keep each cubic between its two values, so the curve adds no extremum of its own. The pixels
 * beyond either end bend the end tangents without being drawn, so an end keeps its shape while its neighbour scrolls
 * out of the drawn range.
 */
function getSmoothTangents(pixels: Pixel[], pixelBefore?: Pixel, pixelAfter?: Pixel): number[] {
  const tangentPixels = [...(pixelBefore ? [pixelBefore] : []), ...pixels, ...(pixelAfter ? [pixelAfter] : [])];
  const offset = pixelBefore ? 1 : 0;
  const slopes = tangentPixels.slice(1).map(([x, y], j) => {
    const [previousX, previousY] = tangentPixels[j];
    return x > previousX ? (y - previousY) / (x - previousX) : 0;
  });
  return pixels.map((_, j) => {
    const k = j + offset;
    if (k === 0) {
      return slopes[0];
    }

    if (k === tangentPixels.length - 1) {
      return slopes[k - 1];
    }

    const before = slopes[k - 1];
    const after = slopes[k];
    return before * after <= 0 ? 0 : 2 * before * after / (before + after);
  });
}

// Each cubic of a smooth line from one pixel to the next, its control points a third of the way along the tangents
function forEachCubic(
  pixels: Pixel[], tangents: number[], callback: (from: Pixel, control1: Pixel, control2: Pixel, to: Pixel) => void,
) {
  for (let j = 1; j < pixels.length; j++) {
    const [previousX, previousY] = pixels[j - 1];
    const [x, y] = pixels[j];
    const third = (x - previousX) / 3;
    const control1: Pixel = [previousX + third, previousY + tangents[j - 1] * third];
    const control2: Pixel = [x - third, y - tangents[j] * third];
    callback(pixels[j - 1], control1, control2, pixels[j]);
  }
}

function getCubicPixel([x0, y0]: Pixel, [x1, y1]: Pixel, [x2, y2]: Pixel, [x3, y3]: Pixel, t: number): Pixel {
  const u = 1 - t;
  const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [
    weights[0] * x0 + weights[1] * x1 + weights[2] * x2 + weights[3] * x3,
    weights[0] * y0 + weights[1] * y1 + weights[2] * y2 + weights[3] * y3,
  ];
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
  const segments = traceRuns(points, projection, true);

  context.save();
  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  const leadLength = measureLead(points, segments, projection, options, true);
  strokeRuns(context, segments, options.dash, leadLength, (segment) => {
    segment.forEach(([x, y], k) => {
      if (k === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
  });
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
  const outline = new Path2D();
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
    outline.lineTo(x, y);
  });
  outline.closePath();

  context.save();
  context.fillStyle = options.color;
  context.globalAlpha = options.opacity * (options.areaOpacity ?? 1);
  context.fill(outline);

  if (options.areaBorder) {
    options.areaBorder.addPath(outline);
  } else if (options.areaBorderColor !== undefined) {
    context.globalAlpha = options.opacity;
    context.strokeStyle = options.areaBorderColor;
    context.lineWidth = AREA_BORDER_WIDTH;
    context.lineJoin = 'bevel';
    context.stroke(outline);
  }

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
    context.fillStyle = options.labelColor!;
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
