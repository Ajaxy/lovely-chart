const TRANSITION_DURATION = 300;

export class Transition {
  constructor(from, to, callback) {
    this._from = from;
    this._to = to;
    this._current = from;
    this._callback = callback;

    this._startedAt = Date.now();

    this._tick = this._tick.bind(this);
    this._tick();
  }

  cancel() {
    cancelAnimationFrame(this._nextFrame);
  }

  getCurrent() {
    return this._current;
  }

  getTarget() {
    return this._current;
  }

  _tick() {
    // TODO reduce `this.` usage to minify code

    const progress = Math.min(1, (Date.now() - this._startedAt) / TRANSITION_DURATION);

    this._current = this._from + (this._to - this._from) * progress;
    this._callback(this._current);

    if (progress < 1) {
      this._nextFrame = requestAnimationFrame(this._tick);
    }
  }
}
