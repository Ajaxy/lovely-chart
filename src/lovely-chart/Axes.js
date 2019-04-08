import { GUTTER, AXES_FONT, X_AXIS_HEIGHT, X_AXIS_SHIFT_START } from './constants';
import { humanize } from './format';
import { buildRgbaFromState, hexToRgba } from './skin';
import { applyXEdgeOpacity, applyYEdgeOpacity, xScaleLevelToStep, yScaleLevelToStep } from './formulas';

export function createAxes(context, data, plotSize) {
  const _context = context;
  const _data = data;
  const _plotSize = plotSize;

  function drawXAxis(state, projection) {
    _context.clearRect(0, _plotSize.height - X_AXIS_HEIGHT, plotSize.width, X_AXIS_HEIGHT);

    const topOffset = _plotSize.height - X_AXIS_HEIGHT / 2;
    const scaleLevel = Math.floor(state.xAxisScale);
    const step = xScaleLevelToStep(scaleLevel);
    const opacityFactor = 1 - (state.xAxisScale - scaleLevel);

    _context.font = AXES_FONT;
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

  function drawYAxis(state, projection, secondaryProjection) {
    const { yAxisScale, yAxisScaleFrom, yAxisScaleTo, yAxisScaleProgress = 0 } = state;
    const color = secondaryProjection && _data.datasets[0].color;

    _drawYAxisScaled(
      state,
      projection,
      Math.round(yAxisScaleFrom || yAxisScale),
      state.yMinViewport,
      state.yMaxViewport,
      1 - yAxisScaleProgress,
      color,
    );

    if (yAxisScaleProgress > 0) {
      _drawYAxisScaled(
        state,
        projection,
        yAxisScaleTo,
        state.yMinViewport,
        state.yMaxViewport,
        yAxisScaleProgress,
        color,
      );
    }

    if (secondaryProjection) {
      const { yAxisScaleSecond, yAxisScaleSecondFrom, yAxisScaleSecondTo, yAxisScaleSecondProgress = 0 } = state;
      const secondaryColor = _data.datasets[_data.datasets.length - 1].color;

      _drawYAxisScaled(
        state,
        secondaryProjection,
        Math.round(yAxisScaleSecondFrom || yAxisScaleSecond),
        state.yMinViewportSecond,
        state.yMaxViewportSecond,
        1 - yAxisScaleSecondProgress,
        secondaryColor,
        true,
      );

      if (yAxisScaleSecondProgress > 0) {
        _drawYAxisScaled(
          state,
          secondaryProjection,
          yAxisScaleSecondTo,
          state.yMinViewportSecond,
          state.yMaxViewportSecond,
          yAxisScaleSecondProgress,
          secondaryColor,
          true,
        );
      }
    }
  }

  function _drawYAxisScaled(state, projection, scaleLevel, yMin, yMax, opacity = 1, color = null, isSecondary = false) {
    const step = yScaleLevelToStep(scaleLevel);
    const firstVisibleValue = Math.ceil(yMin / step) * step;
    const lastVisibleValue = Math.floor(yMax / step) * step;

    _context.font = AXES_FONT;
    _context.textAlign = isSecondary ? 'right' : 'left';
    _context.textBaseline = 'bottom';

    if (!isSecondary) {
      _context.strokeStyle = buildRgbaFromState(state, 'yAxisRulers', opacity);
      _context.lineWidth = 1;
    }

    _context.beginPath();

    for (let value = firstVisibleValue; value <= lastVisibleValue; value += step) {
      const [, yPx] = projection.toPixels(0, value);
      const textOpacity = applyXEdgeOpacity(opacity, yPx);

      // TODO perf
      _context.fillStyle = color ? hexToRgba(color, textOpacity) : buildRgbaFromState(state, 'axesText', textOpacity);

      if (!isSecondary) {
        _context.fillText(humanize(value), GUTTER, yPx - GUTTER / 2);
        _context.moveTo(GUTTER, yPx);
        _context.lineTo(_plotSize.width - GUTTER, yPx);
      } else {
        _context.fillText(humanize(value), _plotSize.width - GUTTER, yPx - GUTTER / 2);
      }
    }


    _context.stroke();
  }

  return { drawXAxis, drawYAxis };
}
