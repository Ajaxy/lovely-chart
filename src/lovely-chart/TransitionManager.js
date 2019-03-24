import { TRANSITION_DURATION } from './constants';

function transition(t) {
  // easeOutSine
  return Math.sin(Math.PI / 2 * t);
}

export function createTransitionManager(onTick) {
  const _onTick = onTick;

  const _transitions = {};

  let _nextFrame = null;

  function add(prop, from, to) {
    _transitions[prop] = { from, to, current: from, startedAt: Date.now() };

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

  function getState() {
    const state = {};

    Object.keys(_transitions).forEach((prop) => {
      state[prop] = _transitions[prop].current;
    });

    return state;
  }

  function isRunning() {
    return Boolean(Object.keys(_transitions).length);
  }

  function _tick() {
    const state = {};

    Object.keys(_transitions).forEach((prop) => {
      const { startedAt, from, to } = _transitions[prop];
      const progress = Math.min(1, (Date.now() - startedAt) / TRANSITION_DURATION);
      const current = from + (to - from) * transition(progress);
      _transitions[prop].current = current;
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
