import type { Projection } from './Projection';
import type { AnalyzedData, ChartColors, ChartState, SecondaryYAxisConfig, Size } from './types';

import { AXES_FONT_STYLE, GUTTER, PLOT_TOP_PADDING, X_AXIS_HEIGHT, X_AXIS_SHIFT_START } from './constants';
import { humanize } from './format';
import { applyXEdgeOpacity, applyYEdgeOpacity, xScaleLevelToStep, yScaleLevelToStep } from './formulas';
import { getCssColor } from './skin';

function getAxesFont(context: CanvasRenderingContext2D): string {
  const fontFamily = getComputedStyle(context.canvas).fontFamily || 'sans-serif';
  return `${AXES_FONT_STYLE} ${fontFamily}`;
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
    const step = xScaleLevelToStep(scaleLevel);
    const opacityFactor = 1 - (state.xAxisScale - scaleLevel);

    context.font = getAxesFont(context);
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (let i = state.labelFromIndex; i <= state.labelToIndex; i++) {
      const shiftedI = i - X_AXIS_SHIFT_START;

      if (shiftedI % step !== 0) {
        continue;
      }

      const label = this.#data.xLabels[i];
      const [xPx] = projection.toPixels(i, 0);
      let opacity = shiftedI % (step * 2) === 0 ? 1 : opacityFactor;
      opacity = applyYEdgeOpacity(opacity, xPx, plotSize.width);

      context.fillStyle = getCssColor(this.#colors, 'x-axis-text', opacity);
      context.fillText(label.text, xPx, topOffset);
    }
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
    const firstVisibleValue = Math.ceil(yMin / step) * step;
    const lastVisibleValue = Math.floor(yMax / step) * step;

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
    const firstVisibleValue = Math.ceil(yMin / step) * step;
    const lastVisibleValue = Math.floor(yMax / step) * step;

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
    if (this.#data.prefixIsCurrency && prefix && formatted.charCodeAt(0) === 45) {
      return `-${prefix}${formatted.slice(1)}${suffix}`;
    }
    return `${prefix}${formatted}${suffix}`;
  }
}
