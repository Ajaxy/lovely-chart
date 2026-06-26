import type { DateLocale, XLabel } from './types';

import {
  MILLISECONDS_IN_DAY, MILLISECONDS_IN_WEEK, MONTHS, MONTHS_FULL, WEEK_DAYS, WEEK_DAYS_SHORT,
} from './constants';

export function formatDayHour(labels: number[], dateLocale?: DateLocale): XLabel[] {
  const months = dateLocale?.months ?? MONTHS;
  return labels.map((value) => {
    const date = new Date(value);
    const hours = String(date.getHours()).padStart(2, '0');
    return {
      value,
      text: `${date.getDate()} ${months[date.getMonth()]} ${hours}:00`,
    };
  });
}

export function formatDayHourFull(value: number, dateLocale?: DateLocale): string {
  const months = dateLocale?.months ?? MONTHS;
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, '0');
  return `${date.getDate()} ${months[date.getMonth()]} ${hours}:00`;
}

export function formatDay(labels: number[], dateLocale?: DateLocale): XLabel[] {
  const months = dateLocale?.months ?? MONTHS;
  return labels.map((value) => {
    const date = new Date(value);
    const day = date.getDate();
    const month = months[date.getMonth()];

    return ({
      value,
      text: `${day} ${month}`,
    });
  });
}

export function formatMin(labels: number[]): XLabel[] {
  return labels.map((value) => ({
    value,
    text: new Date(value).toString().match(/(\d+:\d+):/)![1],
  }));
}

export function formatWeek(labels: number[]): XLabel[] {
  return labels.map((value) => ({
    value,
    text: `Week ${getIsoWeek(value)}`,
  }));
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
  return labels.map((value) => ({
    value,
    text: monthsFull[new Date(value).getUTCMonth()],
  }));
}

export function formatYear(labels: number[]): XLabel[] {
  return labels.map((value) => ({
    value,
    text: String(new Date(value).getUTCFullYear()),
  }));
}

export function formatText(labels: (number | string)[]): XLabel[] {
  return labels.map((value, i) => {
    return ({
      value: i,
      text: String(value),
    });
  });
}

export function humanize(value: number, decimals = 1): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1e6) {
    return sign + keepThreeDigits(abs / 1e6, decimals) + 'M';
  } else if (abs >= 1e3) {
    return sign + keepThreeDigits(abs / 1e3, decimals) + 'K';
  }

  // Delegate to formatInteger: gives thousand separators, decimal trimming
  // and incidentally strips IEEE-754 noise via toFixed rounding
  return formatInteger(value);
}

// TODO perf
function keepThreeDigits(value: number, decimals: number): string {
  return value
    .toFixed(decimals)
    .replace(/(\d{3,})\.\d+/, '$1')
    .replace(/\.0+$/, '');
}

export function formatInteger(n: number): string {
  if (!Number.isInteger(n)) {
    const abs = Math.abs(n);
    const decimals = (abs > 0 && abs < 1)
      ? Math.max(2, -Math.floor(Math.log10(abs)) + 1)
      : 2;
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

export function getLabelTime(label: XLabel): string {
  return new Date(label.value).toString().match(/(\d+:\d+):/)![1];
}
