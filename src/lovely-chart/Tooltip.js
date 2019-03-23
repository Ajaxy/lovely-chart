import { setupCanvas, clearCanvas } from './canvas';
import { BALLOON_OFFSET, SKIN_DAY_BG, WEEK_DAYS, X_AXIS_HEIGHT } from './constants';

export class Tooltip {
  constructor(container, data, plotSize) {
    this._container = container;
    this._data = data;
    this._plotSize = plotSize;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);

    this._setupLayout();
  }

  update(state, projection) {
    this._state = state;
    this._projection = projection;
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

  _setupBalloon(element) {
    const balloon = document.createElement('div');
    balloon.className = 'balloon';
    balloon.innerHTML = '<div class="title"></div><div class="legend"></div>';
    element.appendChild(balloon);
    this._balloon = balloon;
  }

  _onMouseMove(e) {
    this._clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    // TODO throttle until next raf
    this._drawStatistics();
  }

  _onMouseLeave() {
    this._clientX = null;
    clearCanvas(this._canvas, this._context);
    this._hideBalloon();
  }

  _drawStatistics() {
    if (!this._clientX || !this._state) {
      return;
    }

    const clientX = this._clientX;
    const state = this._state;

    const { findClosesLabelIndex, toPixels } = this._projection;
    const labelIndex = findClosesLabelIndex(clientX);

    if (labelIndex < 0 || labelIndex >= this._data.xLabels.length) {
      return;
    }

    clearCanvas(this._canvas, this._context);

    const { xPx } = toPixels(labelIndex, 0);
    this._drawLine(xPx, this._plotSize.height - X_AXIS_HEIGHT);

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

    this._updateBalloon(statistics, xPx, labelIndex);
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

  _updateBalloon(statistics, xPx, labelIndex) {
    const balloon = this._balloon;

    const label = this._data.xLabels[labelIndex];
    const date = new Date(label.value);
    balloon.children[0].innerHTML = `${WEEK_DAYS[date.getDay()]}, ${label.text}`;
    balloon.children[1].innerHTML = statistics.map(({ name, color, value }) => (
      `<div class="dataset" style="color: ${color}"><div>${value}</div><div>${name}</div></div>`
    )).join('');

    const left = Math.max(BALLOON_OFFSET, Math.min(xPx, this._plotSize.width - balloon.offsetWidth + BALLOON_OFFSET));
    balloon.style.left = `${left}px`;
    balloon.classList.add('shown');
  }

  _hideBalloon() {
    this._balloon.classList.remove('shown');
  }
}
