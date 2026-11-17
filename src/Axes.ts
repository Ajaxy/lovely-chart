import type { Projection } from './Projection.js';
import type { AnalyzedData, ChartColors, ChartState, SecondaryYAxisConfig, Size } from './types.js';

import { AXES_FONT_STYLE, GUTTER, PLOT_TOP_PADDING, X_AXIS_HEIGHT } from './constants.js';
import { humanize } from './format.js';
import {
  applyXEdgeOpacity, applyYEdgeOpacity, ceilToStep, floorToStep, getEdgePin, isConstantRange,
  xScaleLevelToStep, yScaleLevelToStep,
} from './formulas.js';
import { getCssColor } from './skin.js';

const X_AXIS_LABEL_GAP = 8;

interface PlacedLabel {
  text: string;
  x: number;
  halfWidth: number;
  opacity: number;
}

export class Axes {
  readonly #context: CanvasRenderingContext2D;
  readonly #data: AnalyzedData;
  readonly #plotSize: Size;
  readonly #colors: ChartColors;

  constructor(context: CanvasRenderingContext2D, data: AnalyzedData, plotSize: Size, colors: ChartColors) {
    this.#context = context;
    this.#data = data;
    this.#plotSize = plotSize;
    this.#colors = colors;
  }

  drawXAxis(state: ChartState, projection: Projection) {
    const context = this.#context;
    const plotSize = this.#plotSize;

    context.clearRect(0, plotSize.height - X_AXIS_HEIGHT + 1, plotSize.width, X_AXIS_HEIGHT + 1);

    const topOffset = plotSize.height - X_AXIS_HEIGHT / 2;
    const scaleLevel = Math.floor(state.xAxisScale);

    context.font = getAxesFont(context);
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

    labels.forEach(({ text, x, opacity }) => {
      context.fillStyle = getCssColor(this.#colors, 'x-axis-text', opacity);
      context.fillText(text, x, topOffset);
    });
  }

  #placeXLabels(state: ChartState, projection: Projection, step: number): PlacedLabel[] {
    const context = this.#context;
    const plotSize = this.#plotSize;
    const plotStart = GUTTER;
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

      const { text } = this.#data.xLabels[i];
      const [xPx] = projection.toPixels(i, 0);
      let opacity = shiftedI % (step * 2) === 0 ? 1 : opacityFactor;
      opacity = applyYEdgeOpacity(opacity, xPx, plotSize.width, startPin, endPin);

      const halfWidth = context.measureText(text).width / 2;
      const x = startPin > 0 || endPin > 0
        ? shiftIntoView(xPx, halfWidth, plotStart, plotEnd, startPin, endPin)
        : xPx;

      labels.push({ text, x, halfWidth, opacity });
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
    const colorKey = secondaryProjection ? `dataset#${this.#data.datasets[0].key}` : undefined;
    const isYChanging = yMinViewportFrom !== undefined || yMaxViewportFrom !== undefined;

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

    if (yAxisScaleProgress > 0 && isYChanging) {
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
    const step = yScaleLevelToStep(scaleLevel);
    const [firstVisibleValue, lastVisibleValue] = getVisibleYTicks(yMin, yMax, step);

    context.font = getAxesFont(context);
    context.textAlign = isSecondary ? 'right' : 'left';
    context.textBaseline = 'bottom';

    context.lineWidth = 1;

    context.beginPath();

    for (let value = firstVisibleValue; value <= lastVisibleValue; value += step) {
      const [, yPx] = projection.toPixels(0, value);
      const textOpacity = applyXEdgeOpacity(opacity, yPx);

      context.fillStyle = colorKey
        ? getCssColor(this.#colors, colorKey, textOpacity)
        : getCssColor(this.#colors, 'y-axis-text', textOpacity);

      const label = isSecondary
        ? humanize(value)
        : this.#formatPrimaryAxisLabel(value);

      if (!isSecondary) {
        context.fillText(label, GUTTER, yPx - GUTTER / 2);
      } else {
        context.fillText(label, plotSize.width - GUTTER, yPx - GUTTER / 2);
      }

      if (isSecondary) {
        context.strokeStyle = getCssColor(this.#colors, colorKey!, opacity);

        context.moveTo(plotSize.width - GUTTER, yPx);
        context.lineTo(plotSize.width - GUTTER * 2, yPx);
      } else {
        context.moveTo(GUTTER, yPx);
        context.strokeStyle = getCssColor(this.#colors, 'grid-lines', opacity);
        context.lineTo(plotSize.width - GUTTER, yPx);
      }
    }

    context.stroke();
  }

  #drawYAxisPercents(projection: Projection) {
    const context = this.#context;
    const plotSize = this.#plotSize;
    const percentValues = [0, 0.25, 0.50, 0.75, 1];
    const [, height] = projection.getSize();

    context.font = getAxesFont(context);
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.lineWidth = 1;

    context.beginPath();

    percentValues.forEach((value) => {
      const yPx = height - height * value + PLOT_TOP_PADDING;

      context.fillStyle = getCssColor(this.#colors, 'y-axis-text', 1);
      context.fillText(`${value * 100}%`, GUTTER, yPx - GUTTER / 4);

      context.moveTo(GUTTER, yPx);
      context.strokeStyle = getCssColor(this.#colors, 'grid-lines', 1);
      context.lineTo(plotSize.width - GUTTER, yPx);
    });

    context.stroke();
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
    const context = this.#context;
    const { multiplier, prefix = '', suffix = '' } = secondaryYAxis;
    const step = yScaleLevelToStep(scaleLevel);
    const [firstVisibleValue, lastVisibleValue] = getVisibleYTicks(yMin, yMax, step);

    context.font = getAxesFont(context);
    context.textAlign = 'right';
    context.textBaseline = 'bottom';

    for (let value = firstVisibleValue; value <= lastVisibleValue; value += step) {
      const [, yPx] = projection.toPixels(0, value);
      const textOpacity = applyXEdgeOpacity(opacity, yPx);
      const secondaryValue = value * multiplier;

      context.fillStyle = getCssColor(this.#colors, 'y-axis-text', textOpacity);
      context.fillText(
        `${prefix}${humanize(secondaryValue)}${suffix}`, this.#plotSize.width - GUTTER, yPx - GUTTER / 2,
      );
    }
  }

  #formatPrimaryAxisLabel(value: number): string {
    const formatted = String(humanize(value));
    const prefix = this.#data.valuePrefix || '';
    const suffix = this.#data.valueSuffix || '';
    if (this.#data.isCurrencyPrefix && prefix && formatted.charCodeAt(0) === 45) {
      return `-${prefix}${formatted.slice(1)}${suffix}`;
    }
    return `${prefix}${formatted}${suffix}`;
  }
}

// A constant range has one label, its value, which the projection puts at the middle height
function getVisibleYTicks(yMin: number, yMax: number, step: number): [number, number] {
  return isConstantRange(yMin, yMax) ? [yMin, yMin] : [ceilToStep(yMin, step), floorToStep(yMax, step)];
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

function getAxesFont(context: CanvasRenderingContext2D): string {
  const fontFamily = getComputedStyle(context.canvas).fontFamily || 'sans-serif';
  return `${AXES_FONT_STYLE} ${fontFamily}`;
}
