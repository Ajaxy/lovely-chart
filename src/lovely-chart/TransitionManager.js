import { TRANSITION_DEFAULT_DURATION } from './constants';

function transition(t) {
  // easeOut
  return 1 - Math.pow(1 - t, 1.675);
}

export function createTransitionManager(onTick) {
  const _onTick = onTick;

  const _transitions = {};

  let _nextFrame = null;

  function add(prop, from, to, duration, options) {
    _transitions[prop] = {
      from,
      to,
      duration,
      options,
      current: from,
      startedAt: Date.now(),
      progress: 0,
    };

    if (!_nextFrame) {
      _nextFrame = requestAnimationFrame(_tick);
    }
  }

  function remove(prop) {
    delete _transitions[prop];

    if (!isRunning()) {
      cancelAnimationFrame(_nextFrame);
      _nextFrame = null;
    }
  }

  function get(prop) {
    return _transitions[prop];
  }

  // TODO keep from last tick
  function getState() {
    const state = {};

    Object.keys(_transitions).forEach((prop) => {
      const { current, from, to, progress } = _transitions[prop];
      state[prop] = current;
      // TODO perf lazy
      state[`${prop}From`] = from;
      state[`${prop}To`] = to;
      state[`${prop}Progress`] = progress;
    });

    return state;
  }

  function isRunning() {
    return Boolean(Object.keys(_transitions).length);
  }

  function _tick() {
    const state = {};

    Object.keys(_transitions).forEach((prop) => {
      const { startedAt, from, to, duration = TRANSITION_DEFAULT_DURATION, options } = _transitions[prop];
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      let current = from + (to - from) * transition(progress);

      if (options.includes('ceil')) {
        current = Math.ceil(current);
      } else if (options.includes('floor')) {
        current = Math.floor(current);
      }

      _transitions[prop].current = current;
      _transitions[prop].progress = progress;
      state[prop] = current;

      if (progress === 1) {
        remove(prop);
      }
    });

    _onTick(state);

    if (isRunning()) {
      _nextFrame = requestAnimationFrame(_tick);
    }
  }

  return { add, remove, get, getState, isRunning };
}
