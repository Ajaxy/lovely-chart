import { GUTTER, AXES_FONT, X_AXIS_HEIGHT, EDGE_POINTS_BUDGET } from './constants';
import { humanize } from './format';
import { buildRgbaFromState } from './skin';

export class Axes {
  constructor(context, data, plotSize) {
    this._context = context;
    this._data = data;
    this._plotSize = plotSize;
  }

  update(state, projection) {
    this._context.font = AXES_FONT;
    this._drawXAxis(state, projection);
    this._drawYAxis(state, projection);
  }

  _drawXAxis(state, projection) {
    const context = this._context;
    const topOffset = this._plotSize.height - X_AXIS_HEIGHT / 2;

    const scaleLevel = Math.floor(state.xAxisScale);
    const visibleLabelsMultiplicity = Math.pow(2, scaleLevel);
    const opacityFactor = 1 - (state.xAxisScale - scaleLevel);

    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (let i = state.labelFromIndex - EDGE_POINTS_BUDGET; i <= state.labelToIndex + EDGE_POINTS_BUDGET; i++) {
      if (i % visibleLabelsMultiplicity !== 0) {
        continue;
      }

      const label = this._data.xLabels[i];
      if (!label) {
        continue;
      }

      const opacity = i % (visibleLabelsMultiplicity * 2) === 0 ? 1 : opacityFactor;
      // TODO perf May be faster to draw by `opacityFactor`, to not change canvas state every time
      context.fillStyle = buildRgbaFromState(state, 'axesText', opacity);

      const { xPx } = projection.toPixels(i, 0);
      context.fillText(label.text, xPx, topOffset);
    }
  }

  _drawYAxis(state, projection) {
    const scaleLevel = state.yAxisScale;

    if (scaleLevel % 1 === 0) {
      this._drawYAxisScaled(state, projection, scaleLevel);
    } else {
      const lower = Math.floor(scaleLevel);
      this._drawYAxisScaled(state, projection, lower, 1 - (scaleLevel - lower));

      const upper = Math.ceil(scaleLevel);
      this._drawYAxisScaled(state, projection, upper, 1 - (upper - scaleLevel));
    }
  }

  _drawYAxisScaled(state, projection, scaleLevel, opacity = 1) {
    const context = this._context;

    const visibleLabelsMultiplicity = Math.pow(scaleLevel, 2) * 2;
    const firstVisibleValue = Math.floor(state.yMin / visibleLabelsMultiplicity) * visibleLabelsMultiplicity;
    const lastVisibleValue = Math.ceil(state.yMax / visibleLabelsMultiplicity) * visibleLabelsMultiplicity;

    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = buildRgbaFromState(state, 'axesText', opacity);
    context.strokeStyle = buildRgbaFromState(state, 'yAxisRulers', opacity);
    context.lineWidth = 0.5;

    context.beginPath();

    for (let value = firstVisibleValue; value <= lastVisibleValue; value += visibleLabelsMultiplicity) {
      const { yPx } = projection.toPixels(0, value);

      context.fillText(humanize(value), GUTTER, yPx - GUTTER / 2);
      context.moveTo(GUTTER, yPx);
      context.lineTo(this._plotSize.width - GUTTER, yPx);
    }

    context.stroke();
  }
}
