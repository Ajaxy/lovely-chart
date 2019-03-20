import { getMaxMin, mergeArrays } from './fast';

export class Viewport {
  constructor(dataInfo) {
    this._dataInfo = dataInfo;
    this._range = {
      begin: 0,
      end: 1,
    };
    this._state = {};

    // this._transition = {
    //   current: null,
    //   from: null,
    //   to: null,
    //   startedAt: null,
    //   progress: null,
    // };

    this._state = this._calculateState();
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

    if (prevState.yMax && prevState.yMax !== this._state.yMax) {
      // TODO transition
      //   currentRealYMax = yMax;
      //   transitionFrom = currentYMax;
      //   transitionTo = yMax;
      //   changeScale();
    }

    // TODO perf check if needed
    this._runCallback();
  }

  onTransitionTick(callback) {
    this._callback = callback;
  }

  _runCallback() {
    requestAnimationFrame(() => this._callback({
      ...this._range,
      ...this._state,
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
}

//
// function changeScale() {
//   if (changingScaleStep) {
//     cancelAnimationFrame(changingScaleStep);
//     transitionFrom = null;
//     transitionTo = null;
//     transitionStartedAt = null;
//   }
//
//   transitionStartedAt = Date.now();
//   transitionYMax();
// }
//
// function transitionYMax() {
//   const transitionProgress = (Date.now() - transitionStartedAt) / TRANSITION_DURATION;
//   console.log('transitionProgress', transitionProgress);
//
//   if (transitionProgress > 1) {
//     transitionFrom = null;
//     transitionTo = null;
//     transitionStartedAt = null;
//     return;
//   }
//
//   currentYMax = transitionFrom + (transitionTo - transitionFrom) * transitionProgress;
//
//   changingScaleStep = requestAnimationFrame(transitionYMax);
// }
