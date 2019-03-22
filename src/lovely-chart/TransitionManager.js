import { TRANSITION_DURATION } from './constants';

// TODO ease-out
function linearTransition(from, to, progress) {
  return from + (to - from) * progress;
}

export class TransitionManager {
  constructor(onTick) {
    this._onTick = onTick;

    this._transitions = {};
    this._nextFrame = null;

    this._tick = this._tick.bind(this);
  }

  add(prop, from, to, fn = linearTransition) {
    this._transitions[prop] = { from, to, fn, current: from, startedAt: Date.now() };

    if (!this._nextFrame) {
      this._nextFrame = requestAnimationFrame(this._tick);
    }
  }

  remove(prop) {
    delete this._transitions[prop];

    if (!this._isActual()) {
      cancelAnimationFrame(this._nextFrame);
      this._nextFrame = null;
    }
  }

  get(prop) {
    return this._transitions[prop];
  }

  getState() {
    const state = {};

    Object.keys(this._transitions).forEach((prop) => {
      state[prop] = this._transitions[prop].current;
    });

    return state;
  }

  _tick() {
    const state = {};

    Object.keys(this._transitions).forEach((prop) => {
      const { startedAt, from, to, fn } = this._transitions[prop];
      const progress = Math.min(1, (Date.now() - startedAt) / TRANSITION_DURATION);
      const current = fn(from, to, progress);
      this._transitions[prop].current = current;
      state[prop] = current;

      if (progress === 1) {
        this.remove(prop);
      }
    });

    this._onTick(state);

    if (this._isActual()) {
      this._nextFrame = requestAnimationFrame(this._tick);
    }
  }

  _isActual() {
    return Object.keys(this._transitions).length;
  }
}
