import { setupCanvas } from './setupCanvas';
import { BALLOON_OFFSET, GUTTER, SKIN_DAY_BG, WEEK_DAYS, X_AXIS_HEIGHT } from './constants';
import { createProjection } from './createProjection';

export class Tooltip {
  constructor(container, data, plotSize) {
    this._container = container;
    this._data = data;
    this._plotSize = plotSize;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);

    this._setupLayout();
  }

  update(state) {
    this._state = state;
    this._drawStatistics();
  }

  _setupLayout() {
    const element = document.createElement('div');
    element.className = 'tooltip';

    this._setupCanvas(element);
    this._setupBalloon(element);

    element.addEventListener('mousemove', this._onMouseMove);
    element.addEventListener('touchmove', this._onMouseMove);

    element.addEventListener('mouseout', this._onMouseLeave);
    element.addEventListener('touchend', this._onMouseLeave);
    element.addEventListener('touchcancel', this._onMouseLeave);

    this._container.appendChild(element);
    this._element = element;
  }

  _setupCanvas(element) {
    const { canvas, context } = setupCanvas(element, this._plotSize);

    this._canvas = canvas;
    this._context = context;
  }

  // TODO extract
  _clearCanvas() {
    this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  _setupBalloon(element) {
    const balloon = document.createElement('div');
    balloon.className = 'balloon';
    balloon.innerHTML = '<div class="title"></div><div class="legend"></div>';
    element.appendChild(balloon);
    this._balloon = balloon;
  }

  _onMouseMove(e) {
    // e.preventDefault();
    this._clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    this._drawStatistics();
  }

  _onMouseLeave() {
    this._clientX = null;
    this._clearCanvas();
    this._hideBalloon();
  }

  _drawStatistics() {
    if (!this._clientX || !this._state) {
      return;
    }

    const clientX = this._clientX;
    const state = this._state;

    const { width, height } = this._plotSize;
    const availableSize = {
      width: width - GUTTER * 2,
      height: height - X_AXIS_HEIGHT,
    };

    const { findClosesLabelIndex, toPixels } = createProjection(state, availableSize, { leftMargin: GUTTER });
    const labelIndex = findClosesLabelIndex(clientX);

    if (labelIndex < 0 || labelIndex >= this._data.xLabels.length) {
      return;
    }

    this._clearCanvas();

    const { xPx } = toPixels(labelIndex, 0);
    this._drawLine(xPx, height - X_AXIS_HEIGHT);

    const statistics = this._data.datasets
      .filter(({ key }) => state.filter[key])
      .map(({ name, color, values }) => ({
        name,
        color,
        value: values[labelIndex],
      }));

    statistics.forEach(({ value, color }) => {
      this._drawCircle(toPixels(labelIndex, value), color);
    });

    this._updateBalloon(statistics, xPx, labelIndex, availableSize);
  }

  _drawCircle({ xPx, yPx }, color) {
    const context = this._context;

    context.strokeStyle = color;
    context.fillStyle = SKIN_DAY_BG;
    context.lineWidth = 2;

    context.beginPath();
    context.arc(xPx, yPx, 4, 0, 2 * Math.PI);
    context.fill();
    context.stroke();
  }

  _drawLine(xPx, height) {
    const context = this._context;

    context.strokeStyle = '#dddddd';
    context.lineWidth = 1;

    context.beginPath();
    context.moveTo(xPx, 0);
    context.lineTo(xPx, height);
    context.stroke();
  }

  _updateBalloon(statistics, xPx, labelIndex, availableSize) {
    const balloon = this._balloon;

    const label = this._data.xLabels[labelIndex];
    const date = new Date(label.value);
    balloon.children[0].innerHTML = `${WEEK_DAYS[date.getDay()]}, ${label.text}`;
    balloon.children[1].innerHTML = statistics.map(({ name, color, value }) => (
      `<div class="dataset" style="color: ${color}"><div>${value}</div><div>${name}</div></div>`
    )).join('');

    const left = Math.max(BALLOON_OFFSET, Math.min(xPx, availableSize.width - balloon.offsetWidth + BALLOON_OFFSET));
    balloon.style.left = `${left}px`;
    balloon.classList.add('shown');
  }

  _hideBalloon() {
    this._balloon.classList.remove('shown');
  }
}
