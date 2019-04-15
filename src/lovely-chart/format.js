import { MONTHS, WEEK_DAYS } from './constants';


export function buildDayLabels(labels) {
  return labels.map((value) => {
    const date = new Date(value);
    const day = date.getDate();
    const month = MONTHS[date.getMonth()];

    return ({
      value,
      text: `${month} ${day}`,
    });
  });
}

export function buildTimeLabels(labels) {
  return labels.map((value) => {
    const date = new Date(value);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();

    return ({
      value,
      text: `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}`,
    });
  });
}

export function humanize(value, decimals = 1) {
  if (value >= 1e6) {
    return keepThreeDigits(value / 1e6, decimals) + 'M';
  } else if (value >= 1e3) {
    return keepThreeDigits(value / 1e3, decimals) + 'K';
  }

  return value;
}

// TODO perf
function keepThreeDigits(value, decimals) {
  return value
    .toFixed(decimals)
    .replace(/(\d{3,})\.\d+/, '$1')
    .replace(/\.0+$/, '');
}

export function formatInteger(n) {
  return String(n).replace(/\d(?=(\d{3})+$)/g, '$& ');
}

export function getFullLabelDate(label) {
  const { value, text } = label;
  const date = new Date(value);

  return `${WEEK_DAYS[date.getDay()]}, ${text} ${date.getFullYear()}`;
}
