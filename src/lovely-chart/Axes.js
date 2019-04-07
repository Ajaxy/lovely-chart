import {
  GUTTER,
  AXES_FONT,
  X_AXIS_HEIGHT,
  EDGE_POINTS_BUDGET,
  X_AXIS_START_FROM,
  PLOT_TOP_PADDING,
} from './constants';
import { humanize } from './format';
import { buildRgbaFromState } from './skin';

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
    const step = Math.pow(2, scaleLevel);
    const opacityFactor = 1 - (state.xAxisScale - scaleLevel);

    _context.textAlign = 'center';
    _context.textBaseline = 'middle';

    for (let i = Math.floor(state.labelFromIndex) - EDGE_POINTS_BUDGET; i <= state.labelToIndex + EDGE_POINTS_BUDGET; i++) {
      if ((i - X_AXIS_START_FROM) % step !== 0) {
        continue;
      }

      const label = _data.xLabels[i];
      if (!label) {
        continue;
      }

      const [xPx] = projection.toPixels(i, 0);

      let opacity = (i - X_AXIS_START_FROM) % (step * 2) === 0 ? 1 : opacityFactor;
      const edgeOffset = Math.min(xPx + GUTTER, _plotSize.width - xPx);
      if (edgeOffset <= GUTTER * 4) {
        opacity = Math.min(1, opacity, edgeOffset / (GUTTER * 4));
      }

      _context.fillStyle = buildRgbaFromState(state, 'axesText', opacity);
      _context.fillText(label.text, xPx, topOffset);
    }
  }

  function _drawYAxis(state, projection) {
    const { yAxisScale, yAxisScaleOriginalFrom, yAxisScaleTo, yAxisScaleTotalProgress } = state;

    if (!yAxisScaleTotalProgress || yAxisScaleTotalProgress % 1 === 0) {
      _drawYAxisScaled(state, projection, yAxisScale);
    } else {
      _drawYAxisScaled(state, projection, yAxisScaleOriginalFrom, 1 - yAxisScaleTotalProgress);
      _drawYAxisScaled(state, projection, yAxisScaleTo, yAxisScaleTotalProgress);
    }
  }

  function _drawYAxisScaled(state, projection, scaleLevel, opacity = 1) {
    const step = scaleLevel <= 13
      ? Math.pow(scaleLevel, 2) * 2
      : ((scaleLevel % 10) || 1) * Math.pow(10, Math.floor(scaleLevel / 10) + 1);
    const firstVisibleValue = Math.floor(state.yMin / step) * step;
    const lastVisibleValue = Math.ceil(state.yMax / step) * step;

    _context.textAlign = 'left';
    _context.textBaseline = 'bottom';
    _context.strokeStyle = buildRgbaFromState(state, 'yAxisRulers', opacity);
    _context.lineWidth = 1;

    _context.beginPath();

    for (let value = firstVisibleValue; value <= lastVisibleValue; value += step) {
      const [, yPx] = projection.toPixels(0, value);

      if (yPx > _plotSize.height - X_AXIS_HEIGHT) {
        continue;
      }

      let textOpacity = opacity;
      if (yPx - GUTTER <= GUTTER * 2) {
        textOpacity = Math.min(1, opacity, (yPx - GUTTER) / (GUTTER * 2));
      }

      _context.fillStyle = buildRgbaFromState(state, 'axesText', textOpacity);
      _context.fillText(humanize(value), GUTTER, yPx - GUTTER / 2);
      _context.moveTo(GUTTER, yPx);
      _context.lineTo(_plotSize.width - GUTTER, yPx);
    }

    _context.stroke();
  }

  return { update };
}
