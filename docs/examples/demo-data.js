// Deterministic demo data for the examples and the live blocks of the guide: the same call returns the same numbers on
// every load, so a chart reads the same for every visitor

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
// The last label of `days()`, `hours()` and `months()` unless an `end` is given
const DEFAULT_END = Date.UTC(2026, 9, 31);

/**
 * `count` UTC midnights a day apart, the last of them on the day of `end`
 */
export function days(count, { end = DEFAULT_END } = {}) {
  const last = Math.floor(end / DAY) * DAY;
  return Array.from({ length: count }, (_, i) => last - (count - 1 - i) * DAY);
}

/**
 * `count` whole hours an hour apart, the last of them at the hour of `end`
 */
export function hours(count, { end = DEFAULT_END + 23 * HOUR } = {}) {
  const last = Math.floor(end / HOUR) * HOUR;
  return Array.from({ length: count }, (_, i) => last - (count - 1 - i) * HOUR);
}

/**
 * The UTC midnights of the first days of `count` months, the last of them the month of `end`
 */
export function months(count, { end = DEFAULT_END } = {}) {
  const date = new Date(end);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return Array.from({ length: count }, (_, i) => Date.UTC(year, month - (count - 1 - i), 1));
}

/**
 * `count` values of a random walk from `start`: each step moves the level by `trend` plus up to `volatility` either
 * way, as fractions of the level, and `seasonality` swings it by that fraction over each `period` of steps. Values stay
 * at `min` or above, rounded to `decimals` digits. Another `seed` gives another walk.
 */
export function series(count, {
  start = 100,
  trend = 0,
  volatility = 0.08,
  seasonality = 0,
  period = 7,
  min = 0,
  decimals = 0,
  seed = 1,
} = {}) {
  const nextRandom = random(seed);
  const factor = 10 ** decimals;
  let level = start;

  return Array.from({ length: count }, (_, i) => {
    if (i > 0) {
      level *= 1 + trend + volatility * (nextRandom() * 2 - 1);
    }
    const value = Math.max(min, level * (1 + seasonality * Math.sin((2 * Math.PI * i) / period)));
    return Math.round(value * factor) / factor;
  });
}

/**
 * A generator of numbers from 0 to 1, the same sequence for the same `seed`
 */
export function random(seed = 1) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
