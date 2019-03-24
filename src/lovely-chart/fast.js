// https://jsperf.com/finding-maximum-element-in-an-array
import { SKIN } from './constants';

export function getMaxMin(array) {
  const length = array.length;
  let max = array[0];
  let min = array[0];

  for (let i = 0; i < length; i++) {
    const value = array[i];

    if (value > max) {
      max = value;
    } else if (value < min) {
      min = value;
    }
  }

  return { max, min };
}

export function ensureSorted(array) {
  for (let i = 0, l = array.length; i < l; i++) {
    if (array[i] !== undefined && array[i + 1] !== undefined && array[i] >= array[i + 1]) {
      throw new Error('Array is not sorted');
    }
  }
}

// https://jsperf.com/multi-array-concat/24
export function mergeArrays(arrays) {
  return [].concat.apply([], arrays);
}

export function createThrottledUntilRaf(fn) {
  let waiting = false;

  return function () {
    if (!waiting) {
      waiting = true;

      requestAnimationFrame(() => {
        waiting = false;
        fn();
      });
    }
  };
}
