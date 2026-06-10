import { SPEED_TEST_FAST_FPS, SPEED_TEST_INTERVAL, TRANSITION_DEFAULT_DURATION } from './constants';

// A detected slow device is re-tested after this cooldown
const SLOW_FPS_COOLDOWN = 5_000;

interface Transition {
  from: number;
  to: number;
  duration: number | undefined;
  options: string[];
  current: number;
  startedAt: number;
  progress: number;
}

export class TransitionManager {
  readonly #onTick: (state: Record<string, number>) => void;

  #transitions: Record<string, Transition> = {};

  #nextFrame?: number;

  #testStartedAt?: number;
  #fps?: number;
  #testingFps?: number;
  #slowDetectedAt?: number;
  #startedAsSlow?: boolean;

  constructor(onTick: (state: Record<string, number>) => void) {
    this.#onTick = onTick;
  }

  add(prop: string, from: number, to: number, duration: number | undefined, options: string[]) {
    this.#transitions[prop] = {
      from,
      to,
      duration,
      options,
      current: from,
      startedAt: Date.now(),
      progress: 0,
    };

    if (!this.#nextFrame) {
      this.#resetSpeedTest();
      this.#nextFrame = requestAnimationFrame(this.#tick);
    }
  }

  remove(prop: string) {
    delete this.#transitions[prop];

    if (!this.isRunning()) {
      cancelAnimationFrame(this.#nextFrame!);
      this.#nextFrame = undefined;
    }
  }

  get(prop: string): Transition | undefined {
    return this.#transitions[prop];
  }

  getState(): Record<string, number> {
    const state: Record<string, number> = {};

    Object.entries(this.#transitions).forEach(([prop, { current, from, to, progress }]) => {
      state[prop] = current;
      // TODO perf lazy
      state[`${prop}From`] = from;
      state[`${prop}To`] = to;
      state[`${prop}Progress`] = progress;
    });

    return state;
  }

  isRunning(): boolean {
    return Boolean(Object.keys(this.#transitions).length);
  }

  isFast(force?: boolean): boolean {
    if (!force && (this.#startedAsSlow || this.#slowDetectedAt)) {
      return false;
    }

    return this.#fps === undefined || this.#fps >= SPEED_TEST_FAST_FPS;
  }

  destroy() {
    if (this.#nextFrame) {
      cancelAnimationFrame(this.#nextFrame);
      this.#nextFrame = undefined;
    }
    this.#transitions = {};
  }

  readonly #tick = () => {
    const isSlow = !this.isFast();
    this.#speedTest();

    const state: Record<string, number> = {};

    Object.entries(this.#transitions).forEach(([prop, item]) => {
      const { startedAt, from, to, duration = TRANSITION_DEFAULT_DURATION, options } = item;
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      let current = from + (to - from) * easeOut(progress);

      if (options.includes('ceil')) {
        current = Math.ceil(current);
      } else if (options.includes('floor')) {
        current = Math.floor(current);
      }

      item.current = current;
      item.progress = progress;
      state[prop] = current;

      if (progress === 1) {
        this.remove(prop);
      }
    });

    if (!isSlow) {
      this.#onTick(state);
    }

    if (this.isRunning()) {
      this.#nextFrame = requestAnimationFrame(this.#tick);
    }
  };

  #resetSpeedTest() {
    this.#testStartedAt = undefined;
    this.#testingFps = undefined;
    if (this.#slowDetectedAt && Date.now() - this.#slowDetectedAt > SLOW_FPS_COOLDOWN) {
      this.#slowDetectedAt = undefined;
    }
    this.#startedAsSlow = Boolean(this.#slowDetectedAt) || !this.isFast(true);
  }

  #speedTest() {
    if (!this.#testStartedAt || (Date.now() - this.#testStartedAt) >= SPEED_TEST_INTERVAL) {
      if (this.#testingFps) {
        this.#fps = this.#testingFps;
        if (!this.#slowDetectedAt && !this.isFast(true)) {
          this.#slowDetectedAt = Date.now();
        }
      }
      this.#testStartedAt = Date.now();
      this.#testingFps = 0;
    } else {
      this.#testingFps = (this.#testingFps || 0) + 1;
    }
  }
}

function easeOut(progress: number): number {
  // Ease-out curve without overshoot (iOS-like)
  return 1 - Math.pow(1 - progress, 3);
}
