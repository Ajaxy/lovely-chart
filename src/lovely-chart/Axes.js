import { GUTTER, AXES_FONT, X_AXIS_HEIGHT, X_AXIS_SHIFT_START } from './constants';
import { humanize } from './format';
import { buildCssColorFromState } from './skin';
import { applyXEdgeOpacity, applyYEdgeOpacity, xScaleLevelToStep, yScaleLevelToStep } from './formulas';

export function createAxes(context, data, plotSize, palette) {
  const _context = context;
  const _data = data;
  const _plotSize = plotSize;
  const _palette = palette;

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

      _context.fillStyle = buildCssColorFromState(state, `palette-${_palette}-x-axis-text`, opacity);
      _context.fillText(label.text, xPx, topOffset);
    }
  }

  function drawYAxis(state, projection, secondaryProjection) {
    const {
      yAxisScale, yAxisScaleFrom, yAxisScaleTo, yAxisScaleProgress = 0,
      yMinViewport, yMinViewportFrom, yMinViewportTo,
      yMaxViewport, yMaxViewportFrom, yMaxViewportTo,
      yMinViewportSecond, yMinViewportSecondFrom, yMinViewportSecondTo,
      yMaxViewportSecond, yMaxViewportSecondFrom, yMaxViewportSecondTo,
    } = state;
    const color = secondaryProjection && _data.datasets[0].colorName;
    const isYChanging = yMinViewportFrom !== undefined || yMaxViewportFrom !== undefined;

    _drawYAxisScaled(
      state,
      projection,
      Math.round(yAxisScaleTo || yAxisScale),
      yMinViewportTo !== undefined ? yMinViewportTo : yMinViewport,
      yMaxViewportTo !== undefined ? yMaxViewportTo : yMaxViewport,
      yAxisScaleFrom ? yAxisScaleProgress : 1,
      color,
    );

    if (yAxisScaleProgress > 0 && isYChanging) {
      _drawYAxisScaled(
        state,
        projection,
        Math.round(yAxisScaleFrom),
        yMinViewportFrom !== undefined ? yMinViewportFrom : yMinViewport,
        yMaxViewportFrom !== undefined ? yMaxViewportFrom : yMaxViewport,
        1 - yAxisScaleProgress,
        color,
      );
    }

    if (secondaryProjection) {
      const { yAxisScaleSecond, yAxisScaleSecondFrom, yAxisScaleSecondTo, yAxisScaleSecondProgress = 0 } = state;
      const secondaryColor = _data.datasets[_data.datasets.length - 1].colorName;
      const isYChanging = yMinViewportSecondFrom !== undefined || yMaxViewportSecondFrom !== undefined;

      _drawYAxisScaled(
        state,
        secondaryProjection,
        Math.round(yAxisScaleSecondTo || yAxisScaleSecond),
        yMinViewportSecondTo !== undefined ? yMinViewportSecondTo : yMinViewportSecond,
        yMaxViewportSecondTo !== undefined ? yMaxViewportSecondTo : yMaxViewportSecond,
        yAxisScaleSecondFrom ? yAxisScaleSecondProgress : 1,
        secondaryColor,
        true,
      );

      if (yAxisScaleSecondProgress > 0 && isYChanging) {
        _drawYAxisScaled(
          state,
          secondaryProjection,
          Math.round(yAxisScaleSecondFrom),
          yMinViewportSecondFrom !== undefined ? yMinViewportSecondFrom : yMinViewportSecond,
          yMaxViewportSecondFrom !== undefined ? yMaxViewportSecondFrom : yMaxViewportSecond,
          1 - yAxisScaleSecondProgress,
          secondaryColor,
          true,
        );
      }
    }
  }

  function _drawYAxisScaled(state, projection, scaleLevel, yMin, yMax, opacity = 1, colorName = null, isSecondary = false) {
    const step = yScaleLevelToStep(scaleLevel);
    const firstVisibleValue = Math.ceil(yMin / step) * step;
    const lastVisibleValue = Math.floor(yMax / step) * step;

    _context.font = AXES_FONT;
    _context.textAlign = isSecondary ? 'right' : 'left';
    _context.textBaseline = 'bottom';

    _context.lineWidth = 1;

    _context.beginPath();

    // TODO start from y0
    for (let value = firstVisibleValue; value <= lastVisibleValue; value += step) {
      const [, yPx] = projection.toPixels(0, value);
      const textOpacity = applyXEdgeOpacity(opacity, yPx);

      // TODO perf
      _context.fillStyle = colorName
        ? buildCssColorFromState(state, `palette-${_palette}-${colorName}-text`, textOpacity)
        : buildCssColorFromState(state, `palette-${_palette}-y-axis-text`, textOpacity);

      if (!isSecondary) {
        _context.fillText(humanize(value), GUTTER, yPx - GUTTER / 2);
      } else {
        _context.fillText(humanize(value), _plotSize.width - GUTTER, yPx - GUTTER / 2);
      }

      if (colorName) {
        _context.strokeStyle = buildCssColorFromState(state, `palette-${_palette}-${colorName}-text`, opacity);

        if (isSecondary) {
          _context.moveTo(_plotSize.width - GUTTER, yPx);
          _context.lineTo(_plotSize.width - GUTTER * 2, yPx);
        } else {
          _context.moveTo(GUTTER, yPx);
          _context.lineTo(GUTTER * 2, yPx);
        }
      } else {
        _context.moveTo(GUTTER, yPx);
        _context.strokeStyle = buildCssColorFromState(state, 'grid-lines', opacity);
        _context.lineTo(_plotSize.width - GUTTER, yPx);
      }
    }

    _context.stroke();
  }

  return { drawXAxis, drawYAxis };
}
