import { getMaxMin, mergeArrays } from './fast';

const TRANSITION_DURATION = 300;

class Transition {
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
    console.log('transitionProgress', progress);

    this._current = this._from + (this._to - this._from) * progress;
    this._callback(this._current);

    if (progress < 1) {
      this._nextFrame = requestAnimationFrame(this._tick);
    }
  }
}

export class Viewport {
  constructor(dataInfo, callback) {
    this._dataInfo = dataInfo;
    this._callback = callback;

    this._range = {
      begin: 0,
      end: 1,
    };
    this._state = {};

    this._state = this._calculateState();

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
    this._state = this._calculateState();

    // TODO also: transition._to != this._state.yMax

    const currentTargetYMax = this._transition ? this._transition.getTarget() : prevState.yMax;

    if (currentTargetYMax && currentTargetYMax !== this._state.yMax) {
      console.log({currentTargetYMax, _state: this._state.yMax});
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

  _calculateState() {
    const { begin, end } = this._range;
    const { datasetsByLabelIndex } = this._dataInfo;
    const totalXWidth = this._dataInfo.xLabels.length;
    const labelFromIndex = Math.max(0, Math.floor(totalXWidth * begin));
    const labelToIndex = Math.min(totalXWidth - 1, Math.ceil(totalXWidth * end));
    const viewportDatasets = datasetsByLabelIndex.map((dataset) => dataset.slice(labelFromIndex, labelToIndex));
    const merged = mergeArrays(viewportDatasets);
    const effective = merged.filter((value) => value !== undefined);
    const { max: yMax } = getMaxMin(effective);
    const yMin = 0; // TODO maybe needed real

    return {
      xShift: begin * totalXWidth,
      xWidth: (end - begin) * totalXWidth,
      yMin,
      yMax,
      yHeight: yMax - yMin,
    };
  }

  _getTransitionState() {
    if (!this._transition) {
      return {};
    }

    return {
      yMax: this._transition.getCurrent()
    };
  }
}
