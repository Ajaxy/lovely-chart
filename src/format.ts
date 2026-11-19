import type { DateLocale, LabelType, XLabel } from './types.js';

import {
  MILLISECONDS_IN_DAY, MILLISECONDS_IN_WEEK, MONTHS, MONTHS_FULL, WEEK_DAYS, WEEK_DAYS_SHORT,
} from './constants.js';

const DECIMAL_BASE = 10;
// Digits after the point of an abbreviated value whose step needs none
const SHORT_FORM_DECIMALS = 1;
// The most significant digits of a step its labels show: an axis step has two at most, a `multiplier` can add more
const MAX_STEP_DIGITS = 3;
// A step within this fraction of itself from a whole number of units of a digit ends at that digit
const STEP_DIGIT_EPSILON = 1e-9;
const TRAILING_ZEROS = /(\.\d*?[1-9])0+$|\.0+$/;
const LETTER = /\p{L}/u;
const RIGHT_TO_LEFT_LETTER = /[\p{sc=Hebrew}\p{sc=Arabic}\p{sc=Syriac}\p{sc=Thaana}\p{sc=Nko}\p{sc=Adlam}]/u;

export function formatDayHour(labels: number[], dateLocale?: DateLocale, isUtc = false): XLabel[] {
  return labels.map((value) => createXLabel(value, formatDayHourFull(value, dateLocale, isUtc)));
}

export function formatDayHourFull(value: number, dateLocale?: DateLocale, isUtc = false): string {
  const months = dateLocale?.months ?? MONTHS;
  const { day, month, hours } = getDateParts(value, isUtc);
  return `${day} ${months[month]} ${padTwoDigits(hours)}:00`;
}

export function formatDay(labels: number[], dateLocale?: DateLocale, isUtc = false): XLabel[] {
  const months = dateLocale?.months ?? MONTHS;
  return labels.map((value) => {
    const { day, month } = getDateParts(value, isUtc);

    return createXLabel(value, `${day} ${months[month]}`);
  });
}

export function formatMin(labels: number[], isUtc = false): XLabel[] {
  return labels.map((value) => createXLabel(value, formatTime(value, isUtc)));
}

export function formatWeek(labels: number[]): XLabel[] {
  return labels.map((value) => createXLabel(value, `Week ${getIsoWeek(value)}`));
}

// ISO 8601: weeks start on Monday and week 1 is the one holding the year's first Thursday
function getIsoWeek(value: number): number {
  const date = new Date(value);
  const thursday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    + (4 - (date.getUTCDay() || 7)) * MILLISECONDS_IN_DAY;
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return Math.floor((thursday - yearStart) / MILLISECONDS_IN_WEEK) + 1;
}

export function formatMonth(labels: number[], dateLocale?: DateLocale): XLabel[] {
  const monthsFull = dateLocale?.monthsFull ?? MONTHS_FULL;
  return labels.map((value) => createXLabel(value, monthsFull[new Date(value).getUTCMonth()]));
}

export function formatYear(labels: number[]): XLabel[] {
  return labels.map((value) => createXLabel(value, String(new Date(value).getUTCFullYear())));
}

export function formatText(labels: (number | string)[]): XLabel[] {
  return labels.map((value, i) => createXLabel(i, String(value)));
}

// A label reads in the direction of its first letter, left to right without one, the way the X axis runs
function createXLabel(value: number, text: string): XLabel {
  const firstLetter = LETTER.exec(text)?.[0] ?? '';
  return { value, text, direction: RIGHT_TO_LEFT_LETTER.test(firstLetter) ? 'rtl' : 'ltr' };
}

// An axis label of a value at a step, with every digit after the point that the step has in the label's unit, so the
// labels of neighbouring multiples of the step differ
export function humanize(value: number, step: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1e12) {
    return sign + formatInUnit(abs / 1e12, step / 1e12) + 'T';
  } else if (abs >= 1e9) {
    return sign + formatInUnit(abs / 1e9, step / 1e9) + 'B';
  } else if (abs >= 1e6) {
    return sign + formatInUnit(abs / 1e6, step / 1e6) + 'M';
  } else if (abs >= 1e3) {
    return sign + formatInUnit(abs / 1e3, step / 1e3) + 'K';
  }

  // Delegate to formatInteger: gives thousand separators, decimal trimming
  // and incidentally strips IEEE-754 noise via toFixed rounding
  return formatInteger(value, countDecimals(step));
}

// A step of whole units keeps the short form, one digit after the point and none past three before it
// TODO perf
function formatInUnit(value: number, step: number): string {
  const decimals = countDecimals(step);
  if (decimals > 0) {
    return value.toFixed(decimals).replace(TRAILING_ZEROS, '$1');
  }

  return value
    .toFixed(SHORT_FORM_DECIMALS)
    .replace(/(\d{3,})\.\d+/, '$1')
    .replace(/\.0+$/, '');
}

// The digits after the point of a step, up to its `MAX_STEP_DIGITS`th significant one
function countDecimals(step: number): number {
  const size = Math.abs(step);
  const maxDecimals = Math.max(0, MAX_STEP_DIGITS - 1 - Math.floor(Math.log10(size)));

  for (let decimals = 0; decimals < maxDecimals; decimals++) {
    const shifted = size * DECIMAL_BASE ** decimals;
    if (Math.abs(shifted - Math.round(shifted)) <= shifted * STEP_DIGIT_EPSILON) {
      return decimals;
    }
  }

  return maxDecimals;
}

export function formatInteger(n: number, minDecimals = 0): string {
  if (!Number.isInteger(n)) {
    const abs = Math.abs(n);
    const decimals = Math.max(minDecimals, (abs > 0 && abs < 1)
      ? Math.max(2, -Math.floor(Math.log10(abs)) + 1)
      : 2);
    const [intPart, decPart] = n.toFixed(decimals).split('.');
    const trimmed = decPart.replace(/0+$/, '');
    return trimmed ? addThousandSeparators(intPart) + '.' + trimmed : addThousandSeparators(intPart);
  }
  return addThousandSeparators(String(n));
}

function addThousandSeparators(s: string): string {
  return s.replace(/\d(?=(\d{3})+$)/g, '$& ');
}

interface LabelDateOptions {
  isShort?: boolean;
  withWeekDay?: boolean;
  withYear?: boolean;
  omitCurrentYear?: boolean;
  withHours?: boolean;
}

export function getFullLabelDate(
  label: XLabel, { isShort = false }: LabelDateOptions = {}, dateLocale?: DateLocale,
): string {
  return getLabelDate(label, { isShort, withWeekDay: true, withYear: true, omitCurrentYear: true }, dateLocale);
}

/**
 * Caption shown when a chart is zoomed into a single label. A day-granularity
 * caption ("Wednesday, 6 Apr") is wrong for coarser charts, where one label
 * stands for a whole month or year, so those get a caption at their own
 * granularity.
 */
export function getZoomCaption(
  label: XLabel, labelType?: LabelType, dateLocale?: DateLocale,
): string {
  const date = new Date(label.value);

  switch (labelType) {
    case 'year':
      return String(date.getUTCFullYear());
    case 'month': {
      const monthsFull = dateLocale?.monthsFull ?? MONTHS_FULL;

      return `${monthsFull[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    }
    default:
      return getFullLabelDate(label, {}, dateLocale);
  }
}

/**
 * Caption for a range spanning several labels, at the chart's own granularity —
 * a month chart reads "Feb — Mar 2029" rather than naming a day inside each end.
 */
export function getRangeCaption(
  from: XLabel, to: XLabel, labelType?: LabelType, dateLocale?: DateLocale,
): string {
  if (labelType === 'year') {
    return `${new Date(from.value).getUTCFullYear()} — ${new Date(to.value).getUTCFullYear()}`;
  }

  if (labelType === 'month') {
    const monthsFull = dateLocale?.monthsFull ?? MONTHS_FULL;
    const fromDate = new Date(from.value);
    const toDate = new Date(to.value);
    const fromYear = fromDate.getUTCFullYear();
    const toYear = toDate.getUTCFullYear();
    const start = monthsFull[fromDate.getUTCMonth()]
      + (fromYear === toYear ? '' : ` ${fromYear}`);

    return `${start} — ${monthsFull[toDate.getUTCMonth()]} ${toYear}`;
  }

  // Leaving out the current year of one end alone would read as a span of the other end's year
  const isSameYear = new Date(from.value).getUTCFullYear() === new Date(to.value).getUTCFullYear();
  const options = { withYear: true, omitCurrentYear: isSameYear };

  return `${getLabelDate(from, options, dateLocale)} — ${getLabelDate(to, options, dateLocale)}`;
}

export function getLabelDate(
  label: XLabel,
  {
    isShort = false, withWeekDay = false, withYear = false, omitCurrentYear = false, withHours = false,
  }: LabelDateOptions = {},
  dateLocale?: DateLocale,
): string {
  const { value } = label;
  const date = new Date(value);
  const months = dateLocale?.months ?? MONTHS;
  const weekDaysArray = isShort
    ? (dateLocale?.weekDaysShort ?? WEEK_DAYS_SHORT)
    : (dateLocale?.weekDays ?? WEEK_DAYS);
  const year = date.getUTCFullYear();

  let string = `${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
  if (withWeekDay) {
    string = `${weekDaysArray[date.getUTCDay()]}, ` + string;
  }
  if (withYear && !(omitCurrentYear && year === new Date().getUTCFullYear())) {
    string += ` ${year}`;
  }
  if (withHours) {
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    string += `, ${hours}:${minutes}`;
  }

  return string;
}

export function getLabelTime(label: XLabel, isUtc = false): string {
  return formatTime(label.value, isUtc);
}

function formatTime(value: number, isUtc: boolean): string {
  const { hours, minutes } = getDateParts(value, isUtc);
  return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}`;
}

function getDateParts(value: number, isUtc: boolean) {
  const date = new Date(value);

  return isUtc
    ? { day: date.getUTCDate(), month: date.getUTCMonth(), hours: date.getUTCHours(), minutes: date.getUTCMinutes() }
    : { day: date.getDate(), month: date.getMonth(), hours: date.getHours(), minutes: date.getMinutes() };
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}
