import { setupCanvas, clearCanvas } from './canvas';
import { BALLOON_OFFSET, GUTTER, WEEK_DAYS, X_AXIS_HEIGHT } from './constants';
import { humanize } from './format';
import { buildCssColorFromState } from './skin';
import { createThrottledUntilRaf } from './fast';
import { addEventListener, createElement } from './minifiers';

const BALLOON_SHADOW_WIDTH = 1;

export function createTooltip(container, data, plotSize, palette, onSelectLabel) {
  const _container = container;
  const _data = data;
  const _plotSize = plotSize;
  const _palette = palette;
  const _onSelectLabel = onSelectLabel;

  let _state;
  let _projection;
  let _coords;
  let _secondaryCoords;
  let _element;
  let _canvas;
  let _context;
  let _balloon;
  let _offsetX;
  let _offsetY;

  const _drawStatisticsOnRaf = createThrottledUntilRaf(_drawStatistics);

  _setupLayout();

  function update(state, projection, coords, secondaryCoords) {
    _state = state;
    _projection = projection;
    _coords = coords;
    _secondaryCoords = secondaryCoords;
    _drawStatistics();
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'tooltip';

    _setupCanvas();
    _setupBalloon();

    if ('ontouchstart' in window) {
      addEventListener(_element, 'touchmove', _onMouseMove);
      addEventListener(_element, 'touchstart', _onMouseMove);
      addEventListener(document, 'touchstart', _onDocumentMove);
    } else {
      addEventListener(_element, 'mousemove', _onMouseMove);
      addEventListener(document, 'mousemove', _onDocumentMove);
    }

    _container.appendChild(_element);
  }

  function _setupCanvas() {
    const { canvas, context } = setupCanvas(_element, _plotSize);

    _canvas = canvas;
    _context = context;
  }

  function _setupBalloon() {
    _balloon = createElement();
    _balloon.className = 'balloon';
    _balloon.innerHTML = '<div class="title"></div><div class="legend"></div>';

    addEventListener(_balloon, 'click', _onBalloonClick);

    _element.appendChild(_balloon);
  }

  function _onMouseMove(e) {
    if (e.target === _balloon || _balloon.contains(e.target)) {
      return;
    }

    const pageOffset = getPageOffset(_element);

    _offsetX = (e.touches ? e.touches[0].clientX : e.clientX) - pageOffset.left;
    _offsetY = (e.touches ? e.touches[0].clientY : e.clientY) - pageOffset.top;

    _drawStatisticsOnRaf();
  }

  function _onDocumentMove(e) {
    if (_offsetX !== null && e.target !== _element && !_element.contains(e.target)) {
      _clear();
    }
  }

  function _onBalloonClick() {
    _balloon.classList.add('loading');

    const labelIndex = _projection.findClosesLabelIndex(_offsetX);

    _onSelectLabel(labelIndex);
  }

  function _clear() {
    _offsetX = null;
    clearCanvas(_canvas, _context);
    _hideBalloon();
  }

  function _drawStatistics() {
    if (!_offsetX || !_state) {
      return;
    }

    const labelIndex = _projection.findClosesLabelIndex(_offsetX);

    if (labelIndex < _state.labelFromIndex || labelIndex > _state.labelToIndex) {
      _clear();
      return;
    }

    clearCanvas(_canvas, _context);

    const [xPx] = _projection.toPixels(labelIndex, 0);
    const lineColor = buildCssColorFromState(_state, 'grid-lines');

    _drawTail(xPx, _plotSize.height - X_AXIS_HEIGHT, lineColor);

    // TODO not working on touch devices
    if (_secondaryCoords && _offsetY <= _plotSize.height - X_AXIS_HEIGHT) {
      _drawHorizontalRuler(_offsetY, _plotSize.width, lineColor);
    }

    const statistics = _data.datasets
      .filter(({ key }) => _state.filter[key])
      .map(({ name, colorName, values, hasOwnYAxis }) => ({
        name,
        colorName,
        value: values[labelIndex],
        hasOwnYAxis,
      }));

    statistics.forEach(({ value, colorName, hasOwnYAxis }, i) => {
      const coordIndex = labelIndex - _state.labelFromIndex;
      const { x, y } = hasOwnYAxis ? _secondaryCoords[coordIndex] : _coords[i][coordIndex];
      // TODO animate
      _drawCircle(
        [x, y],
        buildCssColorFromState(_state, `palette-${_palette}-${colorName}-line`),
        buildCssColorFromState(_state, 'background'),
      );
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
    _balloon.children[1].innerHTML = statistics.map(({ name, colorName, value }) => (
      `<div class="dataset"><span>${name}</span><span class="value ${colorName}">${humanize(value, 2)}</span></div>`
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
