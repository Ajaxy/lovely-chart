import { setupCanvas, clearCanvas } from './canvas';
import { BALLOON_OFFSET, GUTTER, WEEK_DAYS, X_AXIS_HEIGHT } from './constants';
import { humanize } from './format';
import { buildRgbaFromState } from './skin';
import { createThrottledUntilRaf } from './fast';
import { addEventListener, createElement } from './minifiers';

const BALLOON_SHADOW_WIDTH = 1;

export function createTooltip(container, data, plotSize) {
  const _container = container;
  const _data = data;
  const _plotSize = plotSize;

  let _state;
  let _projection;
  let _secondaryProjection;
  let _element;
  let _canvas;
  let _context;
  let _balloon;
  let _offsetX;
  let _offsetY;

  const _drawStatisticsOnRaf = createThrottledUntilRaf(_drawStatistics);

  _setupLayout();

  function update(state, projection, secondaryProjection) {
    _state = state;
    _projection = projection;
    _secondaryProjection = secondaryProjection;
    _drawStatistics();
  }

  function _setupLayout() {
    _element = createElement('div');
    _element.className = 'tooltip';

    _setupCanvas();
    _setupBalloon();

    addEventListener(_element, 'mousemove', _onMouseEnter);
    addEventListener(_element, 'touchmove', _onMouseEnter);
    addEventListener(_element, 'touchstart', _onMouseEnter);

    addEventListener(_element, 'mouseout', _onMouseLeave);
    addEventListener(_element, 'mouseup', _onMouseLeave);
    addEventListener(_element, 'touchend', _onMouseLeave);
    addEventListener(_element, 'touchcancel', _onMouseLeave);

    _container.appendChild(_element);
  }

  function _setupCanvas() {
    const { canvas, context } = setupCanvas(_element, _plotSize);

    _canvas = canvas;
    _context = context;
  }

  function _setupBalloon() {
    _balloon = createElement('div');
    _balloon.className = 'balloon';
    _balloon.innerHTML = '<div class="title"></div><div class="legend"></div>';

    _element.appendChild(_balloon);
  }

  function _onMouseEnter(e) {
    _offsetX = e.offsetX;
    _offsetY = e.offsetY;

    if (e.type.startsWith('touch')) {
      const pageOffset = getPageOffset(e.touches[0].currentTarget);

      _offsetX = e.touches[0].pageX - pageOffset.left;
      _offsetY = e.touches[0].pageY - pageOffset.top;
    }

    _drawStatisticsOnRaf();
  }

  function _onMouseLeave(e) {
    if (e) {
      // Prevent further `mousemove` on touch devices.
      e.preventDefault();
    }

    _offsetX = null;
    clearCanvas(_canvas, _context);
    _hideBalloon();
  }

  function _drawStatistics() {
    if (!_offsetX || !_state) {
      return;
    }

    const offsetX = _offsetX;
    const state = _state;

    const labelIndex = _projection.findClosesLabelIndex(offsetX);

    if (labelIndex < 0 || labelIndex >= _data.xLabels.length) {
      return;
    }

    clearCanvas(_canvas, _context);

    const [xPx] = _projection.toPixels(labelIndex, 0);
    const lineColor = buildRgbaFromState(state, 'tooltipTail');
    _drawTail(xPx, _plotSize.height - X_AXIS_HEIGHT, lineColor);

    if (_secondaryProjection && _offsetY <= _plotSize.height - X_AXIS_HEIGHT) {
      _drawHorizontalRuler(_offsetY, _plotSize.width, lineColor);
    }

    const statistics = _data.datasets
      .filter(({ key }) => state.filter[key])
      .map(({ name, color, values, hasOwnYAxis }) => ({
        name,
        color,
        value: values[labelIndex],
        hasOwnYAxis,
      }));

    statistics.forEach(({ value, color, hasOwnYAxis }) => {
      const projection = hasOwnYAxis ? _secondaryProjection : _projection;
      // TODO animate
      _drawCircle(projection.toPixels(labelIndex, value), color, buildRgbaFromState(state, 'bg'));
    });

    _updateBalloon(statistics, xPx, labelIndex);
  }

  function _drawCircle([xPx, yPx], strokeColor, fillColor) {
    _context.strokeStyle = strokeColor;
    _context.fillStyle = fillColor;
    _context.lineWidth = 2;

    _context.beginPath();
    _context.arc(xPx, yPx, 4, 0, 2 * Math.PI);
    _context.fill();
    _context.stroke();
  }

  function _drawTail(xPx, height, color) {
    _context.strokeStyle = color;
    _context.lineWidth = 1;

    _context.beginPath();
    _context.moveTo(xPx, 0);
    _context.lineTo(xPx, height);
    _context.stroke();
  }

  function _drawHorizontalRuler(y, width, color) {
    _context.strokeStyle = color;
    _context.lineWidth = 1;

    _context.beginPath();
    _context.moveTo(GUTTER, y);
    _context.lineTo(width - GUTTER, y);
    _context.stroke();
  }

  function _updateBalloon(statistics, xPx, labelIndex) {
    const label = _data.xLabels[labelIndex];
    const date = new Date(label.value);
    _balloon.children[0].innerHTML = `${WEEK_DAYS[date.getDay()]}, ${label.text}`;
    _balloon.children[1].innerHTML = statistics.map(({ name, color, value }) => (
      `<div class="dataset" style="color: ${color}"><div>${humanize(value, 2)}</div><div>${name}</div></div>`
    )).join('');

    const left = Math.max(
      BALLOON_OFFSET + BALLOON_SHADOW_WIDTH,
      Math.min(xPx, _plotSize.width - (_balloon.offsetWidth + BALLOON_SHADOW_WIDTH) + BALLOON_OFFSET),
    );
    _balloon.style.left = `${left}px`;
    _balloon.classList.add('shown');
  }

  function _hideBalloon() {
    _balloon.classList.remove('shown');
  }

  return { update };
}

function getPageOffset(el) {
  return el.getBoundingClientRect();
}
