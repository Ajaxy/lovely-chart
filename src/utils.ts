// https://jsperf.com/finding-maximum-element-in-an-array
export function getMaxMin(array: (number | null | undefined)[]): { max?: number; min?: number } {
  const length = array.length;
  let max: number | undefined;
  let min: number | undefined;

  for (let i = 0; i < length; i++) {
    const value = array[i];

    if (value == null) continue;
    if (max === undefined || value > max) max = value;
    if (min === undefined || value < min) min = value;
  }

  return { max, min };
}

// https://jsperf.com/multi-array-concat/24
export function mergeArrays<T>(arrays: T[][]): T[] {
  return ([] as T[]).concat.apply([], arrays as never[]);
}

export function sumArrays(arrays: number[][]): number[] {
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

export function proxyMerge<T extends object, U extends object>(obj1: T, obj2: U): T & U {
  return new Proxy({}, {
    get: (obj: Record<string | symbol, unknown>, prop: string | symbol) => {
      if (obj[prop] !== undefined) {
        return obj[prop];
      } else if ((obj2 as Record<string | symbol, unknown>)[prop] !== undefined) {
        return (obj2 as Record<string | symbol, unknown>)[prop];
      } else {
        return (obj1 as Record<string | symbol, unknown>)[prop];
      }
    },
  }) as T & U;
}

export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
  shouldRunFirst = true,
): (...args: A) => void {
  let interval: number | null = null;
  let isPending: boolean;
  let args: A;

  return (..._args: A) => {
    isPending = true;
    args = _args;

    if (!interval) {
      if (shouldRunFirst) {
        isPending = false;
        fn(...args);
      }

      interval = window.setInterval(() => {
        if (!isPending) {
          window.clearInterval(interval!);
          interval = null;
          return;
        }

        isPending = false;
        fn(...args);
      }, ms);
    }
  };
}

export function throttleWithRaf<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  let waiting = false;
  let args: A;

  return function (..._args: A) {
    args = _args;

    if (!waiting) {
      waiting = true;

      requestAnimationFrame(() => {
        waiting = false;
        fn(...args);
      });
    }
  };
}

export function debounce(fn: () => void, ms: number, shouldRunFirst = true, shouldRunLast = true): () => void {
  let waitingTimeout: number | null = null;

  return function () {
    if (waitingTimeout) {
      clearTimeout(waitingTimeout);
      waitingTimeout = null;
    } else if (shouldRunFirst) {
      fn();
    }

    waitingTimeout = window.setTimeout(() => {
      if (shouldRunLast) {
        fn();
      }

      waitingTimeout = null;
    }, ms);
  };
}
