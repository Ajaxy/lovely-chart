import { GAP } from './constants.js';

// Manual loop keeps this hot path allocation-free and safe for huge arrays
export function getMaxMin(array: (number | null | undefined)[]): { max?: number; min?: number } {
  const length = array.length;
  let max: number | undefined;
  let min: number | undefined;

  for (let i = 0; i < length; i++) {
    const value = array[i];

    if (value === GAP || value === undefined) continue;
    if (max === undefined || value > max) max = value;
    if (min === undefined || value < min) min = value;
  }

  return { max, min };
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

export function mergeProxied<T extends object, U extends object>(base: T, override: U): T & U {
  return new Proxy({}, {
    get: (target: Record<string | symbol, unknown>, prop: string | symbol) => {
      if (target[prop] !== undefined) {
        return target[prop];
      } else if ((override as Record<string | symbol, unknown>)[prop] !== undefined) {
        return (override as Record<string | symbol, unknown>)[prop];
      } else {
        return (base as Record<string | symbol, unknown>)[prop];
      }
    },
  }) as T & U;
}

// A deferred function, whose `cancel` drops the call it holds
export type Cancelable<A extends unknown[]> = ((...args: A) => void) & { cancel: () => void };

export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
  shouldRunFirst = true,
): Cancelable<A> {
  let interval: number | undefined;
  let isPending: boolean;
  let args: A;

  function cancel() {
    window.clearInterval(interval);
    interval = undefined;
    isPending = false;
  }

  return Object.assign((..._args: A) => {
    isPending = true;
    args = _args;

    if (!interval) {
      if (shouldRunFirst) {
        isPending = false;
        fn(...args);
      }

      interval = window.setInterval(() => {
        if (!isPending) {
          cancel();
          return;
        }

        isPending = false;
        fn(...args);
      }, ms);
    }
  }, { cancel });
}

export function throttleWithRaf<A extends unknown[]>(fn: (...args: A) => void): Cancelable<A> {
  let frame: number | undefined;
  let args: A;

  return Object.assign(function (..._args: A) {
    args = _args;

    if (frame === undefined) {
      frame = requestAnimationFrame(() => {
        frame = undefined;
        fn(...args);
      });
    }
  }, {
    cancel() {
      if (frame === undefined) return;

      cancelAnimationFrame(frame);
      frame = undefined;
    },
  });
}

export function debounce(fn: () => void, ms: number, shouldRunFirst = true, shouldRunLast = true): Cancelable<[]> {
  let waitingTimeout: number | undefined;

  return Object.assign(function () {
    if (waitingTimeout) {
      clearTimeout(waitingTimeout);
      waitingTimeout = undefined;
    } else if (shouldRunFirst) {
      fn();
    }

    waitingTimeout = window.setTimeout(() => {
      if (shouldRunLast) {
        fn();
      }

      waitingTimeout = undefined;
    }, ms);
  }, {
    cancel() {
      clearTimeout(waitingTimeout);
      waitingTimeout = undefined;
    },
  });
}
