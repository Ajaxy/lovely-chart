// https://jsperf.com/finding-maximum-element-in-an-array
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

export function sumArrays(arrays) {
  const sums = [];
  const n = arrays.length;

  for (let i = 0, l = arrays[0].length; i < l; i++) {
    sums[i] = 0;

    for (let j = 0; j < n; j++) {
      sums[i] += arrays[j][i];
    }
  }

  return sums;
}

export function proxyMerge(obj1, obj2) {
  return new Proxy({}, {
    get: (obj, prop) => {
      return obj2[prop] !== undefined ? obj2[prop] : obj1[prop];
    },
  });
}

export function throttle(fn, ms, shouldRunFirst = true, shouldRunLast = true) {
  let waiting = false;
  let args;

  return function (..._args) {
    args = _args;

    if (!waiting) {
      if (shouldRunFirst) {
        fn(...args);
      }

      waiting = true;

      setTimeout(() => {
        waiting = false;

        if (shouldRunLast) {
          fn(...args);
        }
      }, ms);
    }
  };
}

export function throttleWithRaf(fn) {
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

export function debounce(fn, ms, shouldRunFirst = true, shouldRunLast = true) {
  let waitingTimeout = null;

  return function () {
    if (waitingTimeout) {
      clearTimeout(waitingTimeout);
      waitingTimeout = null;
    } else if (shouldRunFirst) {
      fn();
    }

    waitingTimeout = setTimeout(() => {
      if (shouldRunLast) {
        fn();
      }

      waitingTimeout = null;
    }, ms);
  };
}
