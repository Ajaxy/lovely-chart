import { GUTTER, AXES_FONT, X_AXIS_HEIGHT, X_AXIS_SHIFT_START } from './constants';
import { humanize } from './format';
import { buildRgbaFromState } from './skin';
import { applyXEdgeOpacity, applyYEdgeOpacity, xScaleLevelToStep, yScaleLevelToStep } from './formulas';

export function createAxes(context, data, plotSize) {
  const _context = context;
  const _data = data;
  const _plotSize = plotSize;

  function update(state, projection) {
    _context.font = AXES_FONT;

    _drawXAxis(state, projection);
    _drawYAxis(state, projection);
  }

  function _drawXAxis(state, projection) {
    const topOffset = _plotSize.height - X_AXIS_HEIGHT / 2;
    const scaleLevel = Math.floor(state.xAxisScale);
    const step = xScaleLevelToStep(scaleLevel);
    const opacityFactor = 1 - (state.xAxisScale - scaleLevel);

    _context.textAlign = 'center';
    _context.textBaseline = 'middle';

    for (let i = state.labelFromIndex; i <= state.labelToIndex; i++) {
      const shiftedI = i - X_AXIS_SHIFT_START;

      if (shiftedI % step !== 0) {
        continue;
      }

      const label = _data.xLabels[i];
      const [xPx] = projection.toPixels(i, 0);
      let opacity = shiftedI % (step * 2) === 0 ? 1 : opacityFactor;
      opacity = applyYEdgeOpacity(opacity, xPx, _plotSize.width);

      _context.fillStyle = buildRgbaFromState(state, 'axesText', opacity);
      _context.fillText(label.text, xPx, topOffset);
    }
  }

  function _drawYAxis(state, projection) {
    const { yAxisScale, yAxisScaleFrom, yAxisScaleTo, yAxisScaleProgress = 0 } = state;

    _drawYAxisScaled(state, projection, Math.round(yAxisScaleFrom || yAxisScale), 1 - yAxisScaleProgress);

    if (yAxisScaleProgress > 0) {
      _drawYAxisScaled(state, projection, yAxisScaleTo, yAxisScaleProgress);
    }
  }

  function _drawYAxisScaled(state, projection, scaleLevel, opacity = 1) {
    const step = yScaleLevelToStep(scaleLevel);
    const firstVisibleValue = Math.floor(state.yMin / step) * step;
    const lastVisibleValue = Math.ceil(state.yMax / step) * step;

    _context.textAlign = 'left';
    _context.textBaseline = 'bottom';
    _context.strokeStyle = buildRgbaFromState(state, 'yAxisRulers', opacity);
    _context.lineWidth = 1;

    _context.beginPath();

    for (let value = firstVisibleValue; value <= lastVisibleValue; value += step) {
      const [, yPx] = projection.toPixels(0, value);
      const textOpacity = applyXEdgeOpacity(opacity, yPx);

      _context.fillStyle = buildRgbaFromState(state, 'axesText', textOpacity);
      _context.fillText(humanize(value), GUTTER, yPx - GUTTER / 2);
      _context.moveTo(GUTTER, yPx);
      _context.lineTo(_plotSize.width - GUTTER, yPx);
    }

    _context.stroke();
  }

  return { update };
}
