import { GUTTER, AXES_FONT, X_AXIS_HEIGHT } from './constants';

export class Axes {
  constructor(context, data, plotSize) {
    this._context = context;
    this._data = data;
    this._plotSize = plotSize;
  }

  draw(state) {
    this._context.font = AXES_FONT;
    this._drawXAxis(state);
    this._drawYAxis(state);
  }

  _drawXAxis(state) {
    const context = this._context;
    const { width: plotWidth, height: plotHeight } = this._plotSize;
    const topOffset = plotHeight - X_AXIS_HEIGHT / 2;

    const labelsCount = this._data.xLabels.length;
    const viewportPercent = state.end - state.begin;

    const scaleLevel = Math.floor(state.xAxisScale);
    const visibleLabelsMultiplicity = Math.pow(2, scaleLevel);
    const opacityFactor = 1 - (state.xAxisScale - scaleLevel);

    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // TODO perf Draw only visible
    this._data.xLabels.forEach((label, i) => {
      if (i % visibleLabelsMultiplicity !== 0) {
        return;
      }

      const totalProgress = i / labelsCount;
      const viewportProgress = (totalProgress - state.begin) / viewportPercent;
      const leftOffset = viewportProgress * plotWidth;
      const opacity = i % (visibleLabelsMultiplicity * 2) === 0 ? 1 : opacityFactor;

      // TODO perf May be faster to draw by `opacityFactor`, to not change canvas state every time
      context.fillStyle = `rgba(180, 180, 180, ${opacity})`;
      context.fillText(label.text, leftOffset, topOffset);
    });
  }

  _drawYAxis(state) {
    const scaleLevel = state.yAxisScale;

    if (scaleLevel % 1 === 0) {
      this._drawYAxisScaled(state, scaleLevel);
    } else {
      const lower = Math.floor(scaleLevel);
      this._drawYAxisScaled(state, lower, 1 - (scaleLevel - lower));

      const upper = Math.ceil(scaleLevel);
      this._drawYAxisScaled(state, upper, 1 - (upper - scaleLevel));
    }
  }

  _drawYAxisScaled(state, scaleLevel, opacity = 1) {
    const context = this._context;
    const { width: plotWidth, height: plotHeight } = this._plotSize;
    const leftOffset = GUTTER;

    const viewportLabelsCount = state.yMax - state.yMin;
    const visibleLabelsMultiplicity = Math.pow(scaleLevel, 2) * 2;

    const availableHeight = plotHeight - X_AXIS_HEIGHT;
    const rowHeight = availableHeight / viewportLabelsCount;

    const firstVisibleValue = Math.floor(state.yMin / visibleLabelsMultiplicity) * visibleLabelsMultiplicity;
    const lastVisibleValue = Math.ceil(state.yMax / visibleLabelsMultiplicity) * visibleLabelsMultiplicity;

    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = `rgba(180, 180, 180, ${opacity})`;
    context.strokeStyle = `rgba(238, 238, 238, ${opacity})`;
    context.lineWidth = 0.5;

    context.beginPath();

    for (let i = firstVisibleValue; i <= lastVisibleValue; i += visibleLabelsMultiplicity) {
      const viewportIndex = i - firstVisibleValue;
      const topOffset = availableHeight - viewportIndex * rowHeight;

      // TODO start using K, M
      context.fillText(i, leftOffset, topOffset - GUTTER / 2);

      context.moveTo(GUTTER, topOffset);
      context.lineTo(plotWidth - GUTTER, topOffset);
    }

    context.stroke();
  }
}
