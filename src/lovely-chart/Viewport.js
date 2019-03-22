import { TransitionManager } from './TransitionManager';
import { calculateState } from './calculateState';

const ANIMATE_PROPS = ['yMax'];

export class Viewport {
  constructor(dataInfo, callback) {
    this._dataInfo = dataInfo;
    this._callback = callback;

    this._range = {
      begin: 0,
      end: 1,
    };
    this._state = {};

    this._runCallback = this._runCallback.bind(this);
    this._transitions = new TransitionManager(this._runCallback);
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

    ANIMATE_PROPS.forEach((prop) => {
      const transition = this._transitions.get(prop);
      const currentTarget = transition ? transition.to : prevState[prop];

      if (currentTarget && currentTarget !== this._state[prop]) {
        const current = transition ? transition.current : prevState[prop];

        if (transition) {
          this._transitions.remove(prop);
        }

        this._transitions.add(prop, current, this._state[prop]);
      }
    });

    // TODO only needed if no transitions
    requestAnimationFrame(this._runCallback);
  }

  _runCallback() {
    this._callback({
      ...this._range,
      ...this._state,
      ...this._transitions.getState(),
    });
  }
}
