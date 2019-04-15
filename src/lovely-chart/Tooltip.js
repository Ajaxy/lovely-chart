import { setupCanvas, clearCanvas } from './canvas';
import { BALLOON_OFFSET, WEEK_DAYS, X_AXIS_HEIGHT } from './constants';
import { formatInteger } from './format';
import { buildCssColorFromState } from './skin';
import { throttleWithRaf } from './fast';
import { addEventListener, createElement } from './minifiers';

export function createTooltip(container, data, plotSize, palette, onZoom, onFocus) {
  const _container = container;
  const _data = data;
  const _plotSize = plotSize;
  const _palette = palette;
  const _onZoom = onZoom;
  const _onFocus = onFocus;

  let _state;
  let _points;
  let _projection;
  let _secondaryPoints;
  let _secondaryProjection;

  let _element;
  let _canvas;
  let _context;
  let _balloon;

  let _offsetX;
  let _offsetY;
  let _isClicked = false;

  const _selectLabelOnRaf = throttleWithRaf(_selectLabel);

  _setupLayout();

  function update(state, points, projection, secondaryPoints, secondaryProjection) {
    _state = state;
    _points = points;
    _projection = projection;
    _secondaryPoints = secondaryPoints;
    _secondaryProjection = secondaryProjection;
    _selectLabel(true);
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
      addEventListener(_element, 'click', _onClick);
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
    if (e.target === _balloon || _balloon.contains(e.target) || _isClicked) {
      return;
    }

    const pageOffset = _getPageOffset(_element);
    _offsetX = (e.touches ? e.touches[0].clientX : e.clientX) - pageOffset.left;
    _offsetY = (e.touches ? e.touches[0].clientY : e.clientY) - pageOffset.top;

    const labelIndex = _projection.findClosesLabelIndex(_offsetX);
    if (labelIndex < _state.labelFromIndex || labelIndex > _state.labelToIndex) {
      _clear();
      return;
    }

    _selectLabelOnRaf();
  }

  function _onDocumentMove(e) {
    if (_offsetX !== null && e.target !== _element && !_element.contains(e.target)) {
      _clear();
    }
  }

  function _onClick() {
    _isClicked = !_isClicked;
  }

  function _onBalloonClick() {
    _balloon.classList.add('loading');
    const labelIndex = _projection.findClosesLabelIndex(_offsetX);
    _onZoom(labelIndex);
  }

  function _clear(isExternal) {
    _offsetX = null;
    _isClicked = false;
    clearCanvas(_canvas, _context);
    _hideBalloon();

    if (!isExternal && _onFocus) {
      _onFocus(null);
    }
  }

  function _selectLabel(isExternal) {
    if (!_offsetX || !_state) {
      return;
    }

    const labelIndex = _projection.findClosesLabelIndex(_offsetX);
    const isVisible = labelIndex >= _state.labelFromIndex && labelIndex <= _state.labelToIndex;
    if (!isVisible) {
      _clear(isExternal);
      return;
    }

    if (!isExternal && _onFocus) {
      if (data.isPie) {
        _onFocus(getPointerVector());
      } else {
        _onFocus(labelIndex);
      }
    }

    const [xPx] = _projection.toPixels(labelIndex, 0);
    const statistics = _data.datasets
      .map(({ key, name, colorName, values, hasOwnYAxis }, i) => ({
        key,
        name,
        colorName,
        value: values[labelIndex],
        hasOwnYAxis,
        originalIndex: i,
      }))
      .filter(({ key }) => _state.filter[key]);

    _updateBalloon(statistics, xPx, labelIndex);

    if (_data.isLines || _data.isAreas) {
      clearCanvas(_canvas, _context);

      if (_data.isLines) {
        _drawCircles(statistics, labelIndex);
      }

      _drawTail(xPx, _plotSize.height - X_AXIS_HEIGHT, buildCssColorFromState(_state, 'grid-lines'));
    }
  }

  function _drawCircles(statistics, labelIndex) {
    statistics.forEach(({ value, colorName, hasOwnYAxis, originalIndex }) => {
      const pointIndex = labelIndex - _state.labelFromIndex;
      const point = hasOwnYAxis ? _secondaryPoints[pointIndex] : _points[originalIndex][pointIndex];

      if (!point) {
        return;
      }

      const [x, y] = hasOwnYAxis
        ? _secondaryProjection.toPixels(labelIndex, point.stackValue)
        : _projection.toPixels(labelIndex, point.stackValue);

      // TODO animate
      _drawCircle(
        [x, y],
        buildCssColorFromState(_state, `palette-${_palette}-${colorName}-line`),
        buildCssColorFromState(_state, 'background'),
      );
    });
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

  function _updateBalloon(statistics, xPx, labelIndex) {
    const label = _data.xLabels[labelIndex];
    const date = new Date(label.value);
    _balloon.children[0].innerHTML = `${WEEK_DAYS[date.getDay()]}, ${label.text}`;
    _balloon.children[1].innerHTML = statistics.map(({ name, colorName, value }) => (
      '<div class="dataset transition-container">' +
      `  <span>${name}</span>` +
      `  <span class="value transition top right ${colorName}">${formatInteger(value)}</span>` +
      '</div>'
    )).join('');

    const meanLabel = (_state.labelFromIndex + _state.labelToIndex) / 2;
    const left = labelIndex < meanLabel
      ? _offsetX + BALLOON_OFFSET
      : _offsetX - (_balloon.offsetWidth + BALLOON_OFFSET);

    _balloon.style.transform = `translateX(${left}px) translateZ(0)`;
    _balloon.classList.add('shown');
  }

  function _hideBalloon() {
    _balloon.classList.remove('shown');
  }

  function getPointerVector() {
    const { width, height } = _element.getBoundingClientRect();

    const center = [width / 2, height / 2];
    const angle = Math.atan2(_offsetY - center[1], _offsetX - center[0]);
    const distance = Math.sqrt((_offsetX - center[0]) ** 2 + (_offsetY - center[1]) ** 2);

    return {
      angle: angle >= -Math.PI / 2 ? angle : 2 * Math.PI + angle,
      distance,
    };
  }

  function _getPageOffset(el) {
    return el.getBoundingClientRect();
  }

  return { update };
}

