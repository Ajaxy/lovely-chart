import { TransitionManager } from './TransitionManager';
import { calculateState } from './calculateState';
import { mergeArrays } from './fast';

const ANIMATE_PROPS = ['yMax', 'xAxisScale', 'yAxisScale'];

export class StateManager {
  constructor(dataInfo, viewportSize, callback) {
    this._dataInfo = dataInfo;
    this._viewportSize = viewportSize;
    this._callback = callback;

    this._runCallback = this._runCallback.bind(this);

    // TODO don't save range
    this._range = { begin: 0, end: 1 };
    this._filter = this._buildDefaultFilter();
    this._animateProps = this._buildAnimateProps();
    this._state = {};

    this._transitions = new TransitionManager(this._runCallback);
  }

  update({ range = {}, filter = {} }) {
    Object.assign(this._range, range);
    Object.assign(this._filter, filter);

    const prevState = this._state;
    this._state = calculateState(this._dataInfo, this._viewportSize, this._range, this._filter);

    this._animateProps.forEach((prop) => {
      const transition = this._transitions.get(prop);
      const currentTarget = transition ? transition.to : prevState[prop];

      if (currentTarget !== undefined && currentTarget !== this._state[prop]) {
        const current = transition ? transition.current : prevState[prop];

        if (transition) {
          this._transitions.remove(prop);
        }

        this._transitions.add(prop, current, this._state[prop]);
      }
    });

    requestAnimationFrame(this._runCallback);
  }

  _buildAnimateProps() {
    return mergeArrays([
      ANIMATE_PROPS,
      this._dataInfo.options.map(({ key }) => `opacity#${key}`),
    ]);
  }

  _buildDefaultFilter() {
    const filter = {};

    this._dataInfo.options.forEach(({ name }) => {
      filter[name] = true;
    });

    return filter;
  }

  _runCallback() {
    this._callback({
      ...this._range,
      ...this._state,
      ...this._transitions.getState(),
    });
  }
}
