import { Transition } from './Transition';
import { calculateState } from './calculateState';

export class Viewport {
  constructor(dataInfo, callback) {
    this._dataInfo = dataInfo;
    this._callback = callback;

    this._range = {
      begin: 0,
      end: 1,
    };
    this._state = {};

    this._state = calculateState(this._dataInfo, this._range);

    this._runCallback = this._runCallback.bind(this);
    this._runCallback();
  }

  update({ begin, end }) {
    if (begin !== undefined) {
      this._range.begin = begin;
    }

    if (end !== undefined) {
      this._range.end = end;
    }

    const prevState = this._state;
    this._state = calculateState(this._dataInfo, this._range);

    // TODO also: transition._to != this._state.yMax

    const currentTargetYMax = this._transition ? this._transition.getTarget() : prevState.yMax;

    if (currentTargetYMax && currentTargetYMax !== this._state.yMax) {
      console.log({ currentTargetYMax, _state: this._state.yMax });
      const currentYMax = this._transition ? this._transition.getCurrent() : prevState.yMax;

      if (this._transition) {
        this._transition.cancel();
        this._transition = null;
      }

      this._transition = new Transition(currentYMax, this._state.yMax, this._runCallback);
    }

    this._runCallback();
  }

  _runCallback() {
    requestAnimationFrame(() => this._callback({
      ...this._range,
      ...this._state,
      ...this._getTransitionState(),
    }));
  }

  _getTransitionState() {
    if (!this._transition) {
      return {};
    }

    return {
      yMax: this._transition.getCurrent(),
    };
  }
}
