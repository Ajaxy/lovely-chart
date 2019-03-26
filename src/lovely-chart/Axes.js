import {
  GUTTER,
  AXES_FONT,
  X_AXIS_HEIGHT,
  EDGE_POINTS_BUDGET,
  X_AXIS_START_FROM,
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
    const visibleLabelsMultiplicity = Math.pow(2, scaleLevel);
    const opacityFactor = 1 - (state.xAxisScale - scaleLevel);

    _context.textAlign = 'center';
    _context.textBaseline = 'middle';

    for (let i = Math.floor(state.labelFromIndex) - EDGE_POINTS_BUDGET; i <= state.labelToIndex + EDGE_POINTS_BUDGET; i++) {
      if ((i - X_AXIS_START_FROM) % visibleLabelsMultiplicity !== 0) {
        continue;
      }

      const label = _data.xLabels[i];
      if (!label) {
        continue;
      }

      const { xPx } = projection.toPixels(i, 0);


      let opacity = (i - X_AXIS_START_FROM) % (visibleLabelsMultiplicity * 2) === 0 ? 1 : opacityFactor;
      const edgeOffset = Math.min(xPx + GUTTER, _plotSize.width - xPx);
      if (edgeOffset <= GUTTER * 4) {
        opacity = Math.min(1, opacity, edgeOffset / (GUTTER * 4));
      }

      _context.fillStyle = buildRgbaFromState(state, 'axesText', opacity);
      _context.fillText(label.text, xPx, topOffset);
    }
  }

  function _drawYAxis(state, projection) {
    const scaleLevel = state.yAxisScale;

    if (scaleLevel % 1 === 0) {
      _drawYAxisScaled(state, projection, scaleLevel);
    } else {
      const lower = Math.floor(scaleLevel);
      _drawYAxisScaled(state, projection, lower, 1 - (scaleLevel - lower));

      const upper = Math.ceil(scaleLevel);
      _drawYAxisScaled(state, projection, upper, 1 - (upper - scaleLevel));
    }
  }

  function _drawYAxisScaled(state, projection, scaleLevel, opacity = 1) {
    const visibleLabelsMultiplicity = Math.pow(scaleLevel, 2) * 2;
    const firstVisibleValue = Math.floor(state.yMin / visibleLabelsMultiplicity) * visibleLabelsMultiplicity;
    const lastVisibleValue = Math.ceil(state.yMax / visibleLabelsMultiplicity) * visibleLabelsMultiplicity;

    _context.textAlign = 'left';
    _context.textBaseline = 'bottom';
    _context.fillStyle = buildRgbaFromState(state, 'axesText', opacity);
    _context.strokeStyle = buildRgbaFromState(state, 'yAxisRulers', opacity);
    _context.lineWidth = 0.5;

    _context.beginPath();

    for (let value = firstVisibleValue; value <= lastVisibleValue; value += visibleLabelsMultiplicity) {
      const { yPx } = projection.toPixels(0, value);

      _context.fillText(humanize(value), GUTTER, yPx - GUTTER / 2);
      _context.moveTo(GUTTER, yPx);
      _context.lineTo(_plotSize.width - GUTTER, yPx);
    }

    _context.stroke();
  }

  return { update };
}
