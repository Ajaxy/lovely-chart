import { SPEED_TEST_FAST_FPS, SPEED_TEST_INTERVAL, TRANSITION_DEFAULT_DURATION } from './constants';

export interface Transition {
  from: number;
  to: number;
  duration: number | undefined;
  options: string[];
  current: number;
  startedAt: number;
  progress: number;
}

function transition(t: number): number {
  // iOS-style ease-out (no overshoot)
  return 1 - Math.pow(1 - t, 3);
}

export class TransitionManager {
  #onTick: (state: Record<string, number>) => void;

  #transitions: Record<string, Transition> = {};

  #nextFrame: number | null = null;

  #testStartedAt: number | null = null;
  #fps: number | null = null;
  #testingFps: number | null = null;
  #slowDetectedAt: number | null = null;
  #startedAsSlow: boolean | null = null;

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
      this.#nextFrame = null;
    }
  }

  get(prop: string): Transition | undefined {
    return this.#transitions[prop];
  }

  getState(): Record<string, number> {
    const state: Record<string, number> = {};

    Object.keys(this.#transitions).forEach((prop) => {
      const { current, from, to, progress } = this.#transitions[prop];
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

  isFast(forceCheck?: boolean): boolean {
    if (!forceCheck && (this.#startedAsSlow || this.#slowDetectedAt)) {
      return false;
    }

    return this.#fps === null || this.#fps >= SPEED_TEST_FAST_FPS;
  }

  destroy() {
    if (this.#nextFrame) {
      cancelAnimationFrame(this.#nextFrame);
      this.#nextFrame = null;
    }
    Object.keys(this.#transitions).forEach((prop) => delete this.#transitions[prop]);
  }

  #tick = () => {
    const isSlow = !this.isFast();
    this.#speedTest();

    const state: Record<string, number> = {};

    Object.keys(this.#transitions).forEach((prop) => {
      const { startedAt, from, to, duration = TRANSITION_DEFAULT_DURATION, options } = this.#transitions[prop];
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      let current = from + (to - from) * transition(progress);

      if (options.includes('ceil')) {
        current = Math.ceil(current);
      } else if (options.includes('floor')) {
        current = Math.floor(current);
      }

      this.#transitions[prop].current = current;
      this.#transitions[prop].progress = progress;
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
    this.#testStartedAt = null;
    this.#testingFps = null;
    if (this.#slowDetectedAt && Date.now() - this.#slowDetectedAt > 5000) {
      this.#slowDetectedAt = null;
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
