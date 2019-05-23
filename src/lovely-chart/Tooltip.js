import { setupCanvas, clearCanvas } from './canvas';
import { BALLOON_OFFSET, PIE_BALLOON_MIN_DISTANCE, X_AXIS_HEIGHT } from './constants';
import { formatInteger, getFullLabelDate } from './format';
import { getCssColor } from './skin';
import { throttle, throttleWithRaf } from './utils';
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

  let _isZoomed = false;

  const _selectLabelOnRaf = throttleWithRaf(_selectLabel);
  const _throttledUpdateContent = throttle(_updateContent, 400, true, true);

  _setupLayout();

  function update(state, points, projection, secondaryPoints, secondaryProjection) {
    _state = state;
    _points = points;
    _projection = projection;
    _secondaryPoints = secondaryPoints;
    _secondaryProjection = secondaryProjection;
    _selectLabel(true);
  }

  function toggleSpinner(isLoading) {
    _balloon.classList.toggle('lovely-chart--state-loading', isLoading);
  }

  function toggleIsZoomed(isZoomed) {
    _isZoomed = isZoomed;
    _balloon.classList.toggle('lovely-chart--state-zoomed', isZoomed);
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'lovely-chart--tooltip';

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
    _balloon.className = 'lovely-chart--tooltip-balloon';
    _balloon.innerHTML = '<div class="lovely-chart--tooltip-title"></div><div class="lovely-chart--tooltip-legend"></div><div class="lovely-chart--spinner"></div>';

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
    if (_balloon.classList.contains('lovely-chart--state-zoomed')) {
      return;
    }

    const labelIndex = _projection.findClosestLabelIndex(_offsetX);
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
    const labelIndex = _projection.findClosestLabelIndex(_offsetX);
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

    if (statistics.length && shouldShowBalloon) {
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
    const meanLabel = (_state.labelFromIndex + _state.labelToIndex) / 2;
    const left = labelIndex < meanLabel
      ? _offsetX + BALLOON_OFFSET
      : _offsetX - (_balloon.offsetWidth + BALLOON_OFFSET);

    _balloon.style.transform = `translateX(${left}px) translateZ(0)`;
    _balloon.classList.add('lovely-chart--state-shown');

    const title = _isZoomed ? data.xLabels[labelIndex].text : getFullLabelDate(data.xLabels[labelIndex], true);
    _throttledUpdateContent(title, statistics);
  }

  function _updateContent(title, statistics) {
    const titleContainer = _balloon.children[0];
    const currentTitle = titleContainer.querySelector(':not(.lovely-chart--state-hidden)');

    if (!titleContainer.innerHTML || !currentTitle) {
      titleContainer.innerHTML = `<span>${title}</span>`;
    } else if (currentTitle.innerHTML !== title) {
      toggleText(currentTitle, title, 'lovely-chart--tooltip-title-inner');
    }

    const dataSetContainer = _balloon.children[1];
    Array.from(dataSetContainer.children).forEach((dataSet) => {
      dataSet.setAttribute('data-present', 'false');
    });

    const totalValue = statistics.reduce((a, x) => a + x.value, 0);

    statistics.forEach(({ name, colorName, value }) => {
      const percentageValue = (value / totalValue * 100).toFixed(0);
      value = formatInteger(value);

      const currentDataSet = dataSetContainer.querySelector(`[data-name="${name}"]`);
      const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right lovely-chart--color-${colorName}`;

      if (!currentDataSet) {
        const newDataSet = createElement();
        newDataSet.className = 'lovely-chart--tooltip-dataset';
        newDataSet.setAttribute('data-present', 'true');
        newDataSet.setAttribute('data-name', name);
        newDataSet.innerHTML = `<span class="lovely-chart--dataset-title">${name}</span><span class="${className}">${value}</span>`;
        if (data.isPercentage) {
          newDataSet.innerHTML = `<span class="lovely-chart--percentage-title lovely-chart--position-left">${percentageValue}%</span>` + newDataSet.innerHTML;
        }

        const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
        if (totalText) {
          dataSetContainer.insertBefore(newDataSet, totalText);
        } else {
          dataSetContainer.appendChild(newDataSet);
        }
      } else {
        currentDataSet.setAttribute('data-present', 'true');

        const valueElement = currentDataSet.querySelector(`.lovely-chart--tooltip-dataset-value.lovely-chart--color-${colorName}:not(.lovely-chart--state-hidden)`);
        if (valueElement.innerHTML !== value) {
          toggleText(valueElement, value, className);
        }

        if(data.isPercentage) {
          const percentageElement = currentDataSet.querySelector(`.lovely-chart--percentage-title:not(.lovely-chart--state-hidden)`);
          if (percentageElement.innerHTML !== percentageValue) {
            toggleText(percentageElement, `${percentageValue}%`, 'lovely-chart--percentage-title lovely-chart--position-left');
          }
        }
      }
    });

    if (data.isBars && data.isStacked) {
      _renderTotal(dataSetContainer, formatInteger(totalValue));
    }

    Array.from(dataSetContainer.querySelectorAll('[data-present="false"]'))
      .forEach((dataSet) => {
        dataSet.remove();
      });
  }

  function _renderTotal(dataSetContainer, totalValue) {
    const totalText = dataSetContainer.querySelector(`[data-total="true"]`);
    const className = `lovely-chart--tooltip-dataset-value lovely-chart--position-right`;
    if (!totalText) {
      const newTotalText = createElement();
      newTotalText.className = 'lovely-chart--tooltip-dataset';
      newTotalText.setAttribute('data-present', 'true');
      newTotalText.setAttribute('data-total', 'true');
      newTotalText.innerHTML = `<span>All</span><span class="${className}">${totalValue}</span>`;
      dataSetContainer.appendChild(newTotalText);
    } else {
      totalText.setAttribute('data-present', 'true');

      const valueElement = totalText.querySelector(`.lovely-chart--tooltip-dataset-value:not(.lovely-chart--state-hidden)`);
        if (valueElement.innerHTML !== totalValue) {
          toggleText(valueElement, totalValue, className);
        }
    }
  }

  function _hideBalloon() {
    _balloon.classList.remove('lovely-chart--state-shown');
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

  return { update, toggleSpinner, toggleIsZoomed };
}

