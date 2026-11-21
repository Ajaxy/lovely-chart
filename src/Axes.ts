import type { Projection } from './Projection.js';
import type { AnalyzedData, AnalyzedDataset, ChartColors, ChartState, SecondaryYAxisConfig, Size } from './types.js';

import { drawHalo } from './canvas.js';
import { GUTTER, PLOT_TOP_PADDING, X_AXIS_HEIGHT } from './constants.js';
import { humanize } from './format.js';
import {
  applyXEdgeOpacity, applyYEdgeOpacity, ceilToStep, floorToStep, getConstantLabelStep, getEdgePin, getPlotStart,
  getYAxisRowCount, isConstantRange, xScaleLevelToStep, yScaleLevelToStep,
} from './formulas.js';
import { getCssColor } from './skin.js';
import { listYAxisValues } from './yAxisValues.js';

const X_AXIS_LABEL_GAP = 8;
const CONTRAST_LABEL_PADDING = 2;
// The X-axis band clears from past the half pixel the lowest grid line reaches under the plot bottom
const X_AXIS_CLEAR_OFFSET = 1;
const PERCENT_VALUES = [0, 0.25, 0.5, 0.75, 1];
const DIGITS = '0123456789';
// A text in the axis font that a font of other digits or units measures apart
const FONT_PROBE_TEXT = `${DIGITS}KMBT%`;
const DIGIT_PATTERN = /\d/g;
// A pass of more ticks than this per axis row is a step far finer than its range, mid-transition, and draws nothing
const MAX_Y_TICKS_PER_ROW = 20;

interface AxisLabel {
  text: string;
  x: number;
  y: number;
  colorKey: string;
  opacity: number;
}

interface PlacedLabel {
  text: string;
  direction: CanvasDirection;
  x: number;
  halfWidth: number;
  opacity: number;
}

export class Axes {
  readonly #context: CanvasRenderingContext2D;
  readonly #data: AnalyzedData;
  readonly #plotSize: Size;
  readonly #colors: ChartColors;

  #labelColumnWidth = 0;
  #measuredDatasets?: AnalyzedDataset[];
  #innerLabelWidths: [number, number] = [0, 0];
  #innerMeasuredDatasets?: AnalyzedDataset[];
  #fontProbeWidth?: number;
  #drawnDatasets?: AnalyzedDataset[];
  // From a zoom's swap of the data until the Y range holds still, the labels fading out belong to the data before
  #isFadingOutSwappedData = false;

  constructor(context: CanvasRenderingContext2D, data: AnalyzedData, plotSize: Size, colors: ChartColors) {
    this.#context = context;
    this.#data = data;
    this.#plotSize = plotSize;
    this.#colors = colors;
  }

  // The width of the column left of the plot that holds the main Y-axis labels, `undefined` while they stand inside it
  getLabelColumnWidth(): number | undefined {
    const { isYAxisOutward, isSparkline, isCircle, datasets } = this.#data;
    if (!isYAxisOutward || isSparkline || isCircle) return undefined;

    // A zoom swaps the data in place, and every data set brings datasets of its own
    if (datasets !== this.#measuredDatasets) {
      this.#measuredDatasets = datasets;
      this.#labelColumnWidth = this.#getLabelPadding() + this.#measureWidestYLabel();
    }

    return this.#labelColumnWidth;
  }

  // The widths the Y-axis labels take inside the plot at its start and at its end, their inset included, on the row
  // above each grid line, which text drawn there keeps clear of
  getInnerLabelWidths(): [number, number] {
    const { datasets } = this.#data;
    if (datasets !== this.#innerMeasuredDatasets) {
      this.#innerMeasuredDatasets = datasets;
      const padding = this.#getLabelPadding();
      const startWidth = this.getLabelColumnWidth() === undefined ? this.#measureWidestYLabel() : 0;
      const endWidth = this.#measureWidest(this.#listSecondaryLabelTexts());
      this.#innerLabelWidths = [startWidth && padding + startWidth, endWidth && padding + endWidth];
    }

    return this.#innerLabelWidths;
  }

  resetLabelColumn() {
    this.#measuredDatasets = undefined;
    this.#innerMeasuredDatasets = undefined;
  }

  // `true` on the first call after the axis font changes, however the font arrives
  detectFontChange(): boolean {
    const context = this.#context;
    context.save();
    context.font = getAxesFont(context, this.#data.axisFontSize);
    const width = context.measureText(FONT_PROBE_TEXT).width;
    context.restore();

    const isChanged = this.#fontProbeWidth !== undefined && width !== this.#fontProbeWidth;
    this.#fontProbeWidth = width;
    return isChanged;
  }

  drawXAxis(state: ChartState, projection: Projection) {
    const context = this.#context;
    const plotSize = this.#plotSize;

    const clearTop = plotSize.height - X_AXIS_HEIGHT + X_AXIS_CLEAR_OFFSET;
    context.clearRect(0, clearTop, plotSize.width, plotSize.height - clearTop + 2);

    const topOffset = plotSize.height - X_AXIS_HEIGHT / 2;
    const scaleLevel = Math.floor(state.xAxisScale);

    context.font = getAxesFont(context, this.#data.axisFontSize);
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // A grid that would crowd two labels, an edge label pinned inside the plot included, takes the next coarser
    // step, so the labels stay evenly spaced from the newest one
    let step = xScaleLevelToStep(scaleLevel);
    let labels = this.#placeXLabels(state, projection, step);
    while (labels.some(isCrowdedLabel)) {
      step *= 2;
      labels = this.#placeXLabels(state, projection, step);
    }

    labels.forEach(({ text, direction, x, opacity }) => {
      context.fillStyle = getCssColor(this.#colors, 'x-axis-text', opacity);
      context.direction = direction;
      context.fillText(text, x, topOffset);
    });

    context.direction = 'inherit';
  }

  #placeXLabels(state: ChartState, projection: Projection, step: number): PlacedLabel[] {
    const context = this.#context;
    const plotSize = this.#plotSize;
    const plotStart = getPlotStart(this.getLabelColumnWidth());
    const plotEnd = plotSize.width - GUTTER;
    const scaleLevel = Math.floor(state.xAxisScale);
    const opacityFactor = 1 - (state.xAxisScale - scaleLevel);
    // Per-edge pin: 1 when the range is flush to a data boundary, easing off as it scrolls in
    const innerWidth = plotEnd - plotStart;
    const visibleFraction = state.end - state.begin;
    const startPin = getEdgePin(state.begin / visibleFraction * innerWidth);
    const endPin = getEdgePin((1 - state.end) / visibleFraction * innerWidth);
    const lastLabelIndex = this.#data.xLabels.length - 1;
    const labels: PlacedLabel[] = [];

    for (let i = state.labelFromIndex; i <= state.labelToIndex; i++) {
      // Counted from the newest label, which the grid therefore always holds
      const shiftedI = lastLabelIndex - i;

      if (shiftedI % step !== 0) {
        continue;
      }

      const { text, direction } = this.#data.xLabels[i];
      const [xPx] = projection.toPixels(i, 0);
      let opacity = shiftedI % (step * 2) === 0 ? 1 : opacityFactor;
      opacity = applyYEdgeOpacity(opacity, xPx, plotStart, plotSize.width, startPin, endPin);

      const halfWidth = context.measureText(text).width / 2;
      const x = startPin > 0 || endPin > 0
        ? shiftIntoView(xPx, halfWidth, plotStart, plotEnd, startPin, endPin)
        : xPx;

      labels.push({ text, direction, x, halfWidth, opacity });
    }

    return labels;
  }

  drawYAxis(state: ChartState, projection: Projection, secondaryProjection?: Projection) {
    const {
      yAxisScale, yAxisScaleFrom, yAxisScaleTo, yAxisScaleProgress = 0,
      yMinViewport, yMinViewportFrom, yMinViewportTo,
      yMaxViewport, yMaxViewportFrom, yMaxViewportTo,
      yMinViewportSecond, yMinViewportSecondFrom, yMinViewportSecondTo,
      yMaxViewportSecond, yMaxViewportSecondFrom, yMaxViewportSecondTo,
    } = state;
    // A stack spans the main axis, not its first dataset, so its labels keep the axis text colour
    const colorKey = secondaryProjection && !this.#data.isStacked ? `dataset#${this.#data.datasets[0].key}` : undefined;
    const isYChanging = yMinViewportFrom !== undefined || yMaxViewportFrom !== undefined;

    if (this.#data.datasets !== this.#drawnDatasets) {
      this.#isFadingOutSwappedData = this.#drawnDatasets !== undefined;
      this.#drawnDatasets = this.#data.datasets;
    }
    if (!isYChanging) {
      this.#isFadingOutSwappedData = false;
    }

    if (this.#data.isPercentage) {
      this.#drawYAxisPercents(projection);
    } else if (this.#data.secondaryYAxis) {
      this.#drawYAxisScaled(
        state,
        projection,
        Math.round(yAxisScaleTo || yAxisScale),
        yMinViewportTo !== undefined ? yMinViewportTo : yMinViewport,
        yMaxViewportTo !== undefined ? yMaxViewportTo : yMaxViewport,
        yAxisScaleFrom ? yAxisScaleProgress : 1,
      );

      this.#drawSecondaryYAxis(
        state,
        projection,
        Math.round(yAxisScaleTo || yAxisScale),
        yMinViewportTo !== undefined ? yMinViewportTo : yMinViewport,
        yMaxViewportTo !== undefined ? yMaxViewportTo : yMaxViewport,
        yAxisScaleFrom ? yAxisScaleProgress : 1,
        this.#data.secondaryYAxis,
      );
    } else {
      this.#drawYAxisScaled(
        state,
        projection,
        Math.round(yAxisScaleTo || yAxisScale),
        yMinViewportTo !== undefined ? yMinViewportTo : yMinViewport,
        yMaxViewportTo !== undefined ? yMaxViewportTo : yMaxViewport,
        yAxisScaleFrom ? yAxisScaleProgress : 1,
        colorKey,
      );
    }

    // The label column fits the data on screen alone, so the labels of the data before stay out of it
    const isFadeOutHidden = this.#isFadingOutSwappedData && this.getLabelColumnWidth() !== undefined;
    if (yAxisScaleProgress > 0 && isYChanging && !isFadeOutHidden) {
      this.#drawYAxisScaled(
        state,
        projection,
        Math.round(yAxisScaleFrom),
        yMinViewportFrom !== undefined ? yMinViewportFrom : yMinViewport,
        yMaxViewportFrom !== undefined ? yMaxViewportFrom : yMaxViewport,
        1 - yAxisScaleProgress,
        colorKey,
      );
    }

    if (secondaryProjection) {
      const { yAxisScaleSecond, yAxisScaleSecondFrom, yAxisScaleSecondTo, yAxisScaleSecondProgress = 0 } = state;
      const secondaryColorKey = `dataset#${this.#data.datasets.at(-1)!.key}`;
      const isYChanging = yMinViewportSecondFrom !== undefined || yMaxViewportSecondFrom !== undefined;

      this.#drawYAxisScaled(
        state,
        secondaryProjection,
        Math.round(yAxisScaleSecondTo || yAxisScaleSecond),
        yMinViewportSecondTo !== undefined ? yMinViewportSecondTo : yMinViewportSecond,
        yMaxViewportSecondTo !== undefined ? yMaxViewportSecondTo : yMaxViewportSecond,
        yAxisScaleSecondFrom ? yAxisScaleSecondProgress : 1,
        secondaryColorKey,
        true,
      );

      if (yAxisScaleSecondProgress > 0 && isYChanging) {
        this.#drawYAxisScaled(
          state,
          secondaryProjection,
          Math.round(yAxisScaleSecondFrom),
          yMinViewportSecondFrom !== undefined ? yMinViewportSecondFrom : yMinViewportSecond,
          yMaxViewportSecondFrom !== undefined ? yMaxViewportSecondFrom : yMaxViewportSecond,
          1 - yAxisScaleSecondProgress,
          secondaryColorKey,
          true,
        );
      }
    }
  }

  #drawYAxisScaled(
    state: ChartState,
    projection: Projection,
    scaleLevel: number,
    yMin: number,
    yMax: number,
    opacity = 1,
    colorKey?: string,
    isSecondary = false,
  ) {
    const context = this.#context;
    const plotSize = this.#plotSize;
    const labelColumnWidth = this.getLabelColumnWidth();
    const step = yScaleLevelToStep(scaleLevel);
    const ticks = this.#listYTicks(yMin, yMax, step);
    const labelStep = isConstantRange(yMin, yMax) ? getConstantLabelStep(yMin) : step;
    const labelX = isSecondary ? this.#getSecondaryLabelX() : this.#getMainLabelX(labelColumnWidth);
    const labels: AxisLabel[] = [];

    context.lineWidth = 1;

    context.beginPath();

    ticks.forEach((value) => {
      const [, yPx] = projection.toPixels(0, value);

      labels.push({
        text: isSecondary ? humanize(value, labelStep) : this.#formatAxisLabel(value, labelStep),
        x: labelX,
        y: getLabelY(yPx),
        colorKey: colorKey ?? 'y-axis-text',
        opacity: applyXEdgeOpacity(opacity, yPx),
      });

      if (isSecondary) {
        context.strokeStyle = getCssColor(this.#colors, colorKey!, opacity);

        context.moveTo(plotSize.width - GUTTER, yPx);
        context.lineTo(plotSize.width - GUTTER * 2, yPx);
      } else {
        context.moveTo(getPlotStart(labelColumnWidth), yPx);
        context.strokeStyle = getCssColor(this.#colors, 'grid-lines', opacity);
        context.lineTo(plotSize.width - GUTTER, yPx);
      }
    });

    context.stroke();

    this.#fillAxisLabels(labels, isSecondary || labelColumnWidth !== undefined ? 'right' : 'left');
  }

  #drawYAxisPercents(projection: Projection) {
    const context = this.#context;
    const plotSize = this.#plotSize;
    const labelColumnWidth = this.getLabelColumnWidth();
    const [, height] = projection.getSize();
    const labels: AxisLabel[] = [];

    context.lineWidth = 1;

    context.beginPath();

    PERCENT_VALUES.forEach((value) => {
      const yPx = height - height * value + PLOT_TOP_PADDING;

      labels.push({
        text: formatPercentLabel(value),
        x: this.#getMainLabelX(labelColumnWidth),
        y: yPx - GUTTER / 4,
        colorKey: 'y-axis-text',
        opacity: 1,
      });

      context.moveTo(getPlotStart(labelColumnWidth), yPx);
      context.strokeStyle = getCssColor(this.#colors, 'grid-lines', 1);
      context.lineTo(plotSize.width - GUTTER, yPx);
    });

    context.stroke();

    this.#fillAxisLabels(labels, labelColumnWidth !== undefined ? 'right' : 'left');
  }

  #drawSecondaryYAxis(
    state: ChartState,
    projection: Projection,
    scaleLevel: number,
    yMin: number,
    yMax: number,
    opacity = 1,
    secondaryYAxis: SecondaryYAxisConfig,
  ) {
    const { multiplier, prefix = '', suffix = '' } = secondaryYAxis;
    const step = yScaleLevelToStep(scaleLevel);
    const ticks = this.#listYTicks(yMin, yMax, step);
    const labelStep = isConstantRange(yMin, yMax) ? getConstantLabelStep(yMin * multiplier) : step * multiplier;
    const labels: AxisLabel[] = [];

    ticks.forEach((value) => {
      const [, yPx] = projection.toPixels(0, value);

      labels.push({
        text: this.#formatAxisLabel(value * multiplier, labelStep, prefix, suffix),
        x: this.#getSecondaryLabelX(),
        y: getLabelY(yPx),
        colorKey: 'y-axis-text',
        opacity: applyXEdgeOpacity(opacity, yPx),
      });
    });

    this.#fillAxisLabels(labels, 'right');
  }

  // A constant range has one tick, its value, which the projection puts at the middle height. Every other tick is a
  // whole number of steps, so a tick at 0 carries no float error.
  #listYTicks(yMin: number, yMax: number, step: number): number[] {
    if (isConstantRange(yMin, yMax)) {
      return [yMin];
    }

    const firstIndex = Math.round(ceilToStep(yMin, step) / step);
    const count = Math.round(floorToStep(yMax, step) / step) - firstIndex + 1;
    if (count > getYAxisRowCount(this.#plotSize.height) * MAX_Y_TICKS_PER_ROW) {
      return [];
    }

    return Array.from({ length: Math.max(0, count) }, (_, i) => (firstIndex + i) * step);
  }

  #getMainLabelX(labelColumnWidth: number | undefined): number {
    return labelColumnWidth !== undefined ? GUTTER + labelColumnWidth : GUTTER + this.#getLabelPadding();
  }

  #getSecondaryLabelX(): number {
    return this.#plotSize.width - GUTTER - this.#getLabelPadding();
  }

  // A contrast label stands in from its side of the chart, so a halo inside the plot stays whole at its edge
  #getLabelPadding(): number {
    return this.#data.areLabelsContrast ? CONTRAST_LABEL_PADDING : 0;
  }

  // Drawn after the datasets and the grid, so a halo masks the lines under its label
  #fillAxisLabels(labels: AxisLabel[], textAlign: CanvasTextAlign) {
    const context = this.#context;
    const shouldDrawHalo = this.#data.areLabelsContrast || this.#data.backgroundColor !== undefined;

    context.font = getAxesFont(context, this.#data.axisFontSize);
    context.textAlign = textAlign;
    context.textBaseline = 'bottom';
    // Numbers read left to right, signs first, on a right-to-left page too, while the labels of reference lines and
    // hatched ranges follow the page
    context.direction = 'ltr';

    labels.forEach(({ text, x, y, colorKey, opacity }) => {
      if (shouldDrawHalo) {
        drawHalo(context, text, x, y, getCssColor(this.#colors, 'background', opacity));
      }

      context.fillStyle = getCssColor(this.#colors, colorKey, opacity);
      context.fillText(text, x, y);
    });

    context.direction = 'inherit';
  }

  // The widest label the data can put on the main axis, so the column holds still whatever the reader does
  #measureWidestYLabel(): number {
    return this.#measureWidest(this.#data.isPercentage
      ? PERCENT_VALUES.map(formatPercentLabel)
      : listYAxisValues(this.#data, this.#plotSize.height).map(({ value, step }) => (
        this.#formatAxisLabel(value, step)
      )));
  }

  #listSecondaryLabelTexts(): string[] {
    const { secondaryYAxis, hasSecondYAxis, isPercentage, datasets } = this.#data;
    const height = this.#plotSize.height;
    if (hasSecondYAxis) {
      const ownDataset = datasets.find(({ hasOwnYAxis }) => hasOwnYAxis)!;
      const ownData = { ...this.#data, datasets: [{ ...ownDataset, hasOwnYAxis: false }], referenceLines: [] };
      return listYAxisValues({ ...ownData, comparison: undefined, isStacked: false }, height).map(({ value, step }) => (
        humanize(value, step)
      ));
    }

    if (!secondaryYAxis || isPercentage) return [];

    const { multiplier, prefix = '', suffix = '' } = secondaryYAxis;
    return listYAxisValues(this.#data, height).map(({ value, step }) => (
      this.#formatAxisLabel(value * multiplier, step * multiplier, prefix, suffix)
    ));
  }

  #measureWidest(texts: string[]): number {
    if (!texts.length) return 0;

    const context = this.#context;
    context.save();
    context.font = getAxesFont(context, this.#data.axisFontSize);
    // Large data brings labels by the thousand, none wider than its shape with the widest digit in every place
    const digitWidths = [...DIGITS].map((digit) => context.measureText(digit).width);
    const widestDigit = DIGITS[digitWidths.indexOf(Math.max(...digitWidths))];
    const shapes = new Set(texts.map((text) => text.replace(DIGIT_PATTERN, widestDigit)));
    const width = [...shapes].reduce((widest, shape) => Math.max(widest, context.measureText(shape).width), 0);
    context.restore();

    return Math.ceil(width);
  }

  #formatAxisLabel(
    value: number, step: number, prefix = this.#data.valuePrefix || '', suffix = this.#data.valueSuffix || '',
  ): string {
    const formatted = humanize(value, step);
    if (this.#data.isCurrencyPrefix && prefix && formatted.charCodeAt(0) === 45) {
      return `-${prefix}${formatted.slice(1)}${suffix}`;
    }
    return `${prefix}${formatted}${suffix}`;
  }
}

function formatPercentLabel(value: number): string {
  return `${value * 100}%`;
}

function isCrowdedLabel(label: PlacedLabel, index: number, labels: PlacedLabel[]): boolean {
  if (index === 0) {
    return false;
  }

  const previous = labels[index - 1];
  return label.x - label.halfWidth - (previous.x + previous.halfWidth) < X_AXIS_LABEL_GAP;
}

// Nudge a centered label inward so a pinned edge never clips it, scaled by the edge's pin
function shiftIntoView(
  xPx: number, halfWidth: number, plotStart: number, plotEnd: number, startPin: number, endPin: number,
): number {
  const leftCross = plotStart - (xPx - halfWidth);
  if (leftCross > 0) {
    return xPx + leftCross * startPin;
  }

  const rightCross = xPx + halfWidth - plotEnd;
  if (rightCross > 0) {
    return xPx - rightCross * endPin;
  }

  return xPx;
}

function getAxesFont(context: CanvasRenderingContext2D, fontSize: number): string {
  const { fontFamily, fontWeight } = getComputedStyle(context.canvas);
  return `${fontWeight} ${fontSize}px ${fontFamily || 'sans-serif'}`;
}

// The bottom of a Y-axis label, which `#fillAxisLabels` draws on its baseline, stands half a gutter over its grid line
function getLabelY(tickY: number): number {
  return tickY - GUTTER / 2;
}
