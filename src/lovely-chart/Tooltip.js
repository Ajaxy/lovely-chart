import { setupCanvas, clearCanvas } from './canvas';
import { BALLOON_OFFSET, PIE_BALLOON_MIN_DISTANCE, X_AXIS_HEIGHT } from './constants';
import { formatInteger, getFullLabelDate } from './format';
import { getCssColor } from './skin';
import { throttle, throttleWithRaf } from './fast';
import { addEventListener, createElement } from './minifiers';
import { toggleText } from './toggleText';

export function createTooltip(container, data, plotSize, colors, onZoom, onFocus) {
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
  let _clickedOnLabel = null;

  let _showSpinner = false;
  let _isZoomed = false;

  const _selectLabelOnRaf = throttleWithRaf(_selectLabel);

  _setupLayout();

  function update(state, points, projection, secondaryPoints, secondaryProjection, showSpinner = false, isZoomed = false) {
    _state = state;
    _points = points;
    _projection = projection;
    _secondaryPoints = secondaryPoints;
    _secondaryProjection = secondaryProjection;
    _showSpinner = showSpinner;
    _isZoomed = isZoomed;
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

    container.appendChild(_element);
  }

  function _setupCanvas() {
    const { canvas, context } = setupCanvas(_element, plotSize);

    _canvas = canvas;
    _context = context;
  }

  function _setupBalloon() {
    _balloon = createElement();
    _balloon.className = 'balloon loading';
    _balloon.innerHTML = '<div class="title"></div><div class="legend"></div><div class="spinner"></div>';

    addEventListener(_balloon, 'click', _onBalloonClick);

    _element.appendChild(_balloon);
  }

  function _onMouseMove(e) {
    if (e.target === _balloon || _balloon.contains(e.target) || _clickedOnLabel) {
      return;
    }

    const pageOffset = _getPageOffset(_element);
    _offsetX = (e.touches ? e.touches[0].clientX : e.clientX) - pageOffset.left;
    _offsetY = (e.touches ? e.touches[0].clientY : e.clientY) - pageOffset.top;

    _selectLabelOnRaf();
  }

  function _onDocumentMove(e) {
    if (_offsetX !== null && e.target !== _element && !_element.contains(e.target)) {
      _clear();
    }
  }

  function _onClick(e) {
    const oldLabelIndex = _clickedOnLabel;

    _clickedOnLabel = null;
    _onMouseMove(e, true);

    const newLabelIndex = _getLabelIndex();
    if (newLabelIndex !== oldLabelIndex) {
      _clickedOnLabel = newLabelIndex;
    }
  }

  function _onBalloonClick() {
    _balloon.classList.add('loading');
    const labelIndex = _projection.findClosesLabelIndex(_offsetX);
    onZoom(labelIndex);
  }

  function _clear(isExternal) {
    _offsetX = null;
    _clickedOnLabel = null;
    clearCanvas(_canvas, _context);
    _hideBalloon();

    if (!isExternal && onFocus) {
      onFocus(null);
    }
  }

  function _getLabelIndex() {
    const labelIndex = _projection.findClosesLabelIndex(_offsetX);
    return labelIndex < _state.labelFromIndex || labelIndex > _state.labelToIndex ? null : labelIndex;
  }

  function _selectLabel(isExternal) {
    if (!_offsetX || !_state) {
      return;
    }

    const labelIndex = _getLabelIndex();
    if (!labelIndex) {
      _clear(isExternal);
      return;
    }

    const pointerVector = getPointerVector();
    // TODO filter focused data
    const shouldShowBalloon = data.isPie ? pointerVector.distance >= PIE_BALLOON_MIN_DISTANCE : true;

    if (!isExternal && onFocus) {
      if (data.isPie) {
        onFocus(pointerVector);
      } else {
        onFocus(labelIndex);
      }
    }

    const [xPx] = _projection.toPixels(labelIndex, 0);
    const statistics = data.datasets
      .map(({ key, name, colorName, values, hasOwnYAxis }, i) => ({
        key,
        name,
        colorName,
        value: values[labelIndex],
        hasOwnYAxis,
        originalIndex: i,
      }))
      .filter(({ key }) => _state.filter[key]);

    if (shouldShowBalloon) {
      _updateBalloon(statistics, xPx, labelIndex);
    } else {
      _hideBalloon();
    }

    if (data.isLines || data.isAreas) {
      clearCanvas(_canvas, _context);

      if (data.isLines) {
        _drawCircles(statistics, labelIndex);
      }

      _drawTail(xPx, plotSize.height - X_AXIS_HEIGHT, getCssColor(colors, 'grid-lines'));
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
        getCssColor(colors, `${colorName}-line`),
        getCssColor(colors, 'background'),
      )
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

  const _updateBalloonDataThrottled = throttle(_updateBalloonData, 800, false, true);
  let _isFirstUpdate = true;

  function _updateBalloon(statistics, xPx, labelIndex) {
    if (_isFirstUpdate) {
      // This prevents initial render delay made by throttling
      _updateBalloonData(statistics, labelIndex, true);
      _isFirstUpdate = false;
    } else {
      _updateBalloonDataThrottled(statistics, labelIndex);
    }

    const meanLabel = (_state.labelFromIndex + _state.labelToIndex) / 2;
    const left = labelIndex < meanLabel
      ? _offsetX + BALLOON_OFFSET
      : _offsetX - (_balloon.offsetWidth + BALLOON_OFFSET);

    _balloon.style.transform = `translateX(${left}px) translateZ(0)`;
    _balloon.classList.toggle('loading', _showSpinner);
    _balloon.classList.toggle('zoomed', _isZoomed);
    _balloon.classList.add('shown');
  }

  function _updateBalloonData(statistics, labelIndex, force = false) {
    const label = data.xLabels[labelIndex];

    _updateTitle(getFullLabelDate(data.xLabels[labelIndex]), force);
    _updateDataSets(statistics, force);
  }

  function _updateTitle(title, force = false) {
    const titleContainer = _balloon.children[0];
    const currentTitle = titleContainer.querySelector(':not(.hidden)');

    if (force || !titleContainer.innerHTML || !currentTitle) {
      titleContainer.innerHTML = `<span>${title}</span>`;
    } else if (currentTitle.innerHTML !== title) {
      toggleText(currentTitle, title, 'title-inner');
    }
  }

  function _updateDataSets(data, force = false) {
    const dataSetContainer = _balloon.children[1];
    const currentDataSets = dataSetContainer.children;
    for (const d of currentDataSets) {
      d.setAttribute('data-present', 'false');
    }

    data.forEach(({ name, colorName, value }) => {
      const currentDataSet = dataSetContainer.querySelector(`[data-name="${name}"]`);
      const className = `value right ${colorName}`;
      if (force || !currentDataSet) {
        const newDataSet = createElement();
        newDataSet.className = 'dataset';
        newDataSet.setAttribute('data-present', 'true');
        newDataSet.setAttribute('data-name', name);
        newDataSet.innerHTML = `<span>${name}</span>` + `<span class="${className}">${formatInteger(value)}</span>`;
        dataSetContainer.appendChild(newDataSet);
      } else {
        currentDataSet.setAttribute('data-present', 'true');
        const valueElement = currentDataSet.querySelector(`.value.${colorName}:not(.hidden)`);
        if (valueElement.innerHTML != value) {
          toggleText(valueElement, formatInteger(value), className);
        }
      }
    });

    const oldDataSets = dataSetContainer.querySelectorAll('[data-present="false"]');
    for (const d of oldDataSets) {
      d.remove();
    }
  }

  function _hideBalloon() {
    _balloon.classList.remove('shown');
    _isFirstUpdate = true;
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

