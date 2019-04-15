import { DAY_MS, HOUR_MS, MONTHS, WEEK_DAYS } from './constants';

export function buildDayLabels(timestampFrom, timestampTo) {
  timestampFrom = roundToDay(timestampFrom);
  timestampTo = roundToDay(timestampTo);

  const labels = [];

  for (let timestamp = timestampFrom; timestamp <= timestampTo; timestamp += DAY_MS) {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = MONTHS[date.getMonth()];

    labels.push({
      value: timestamp,
      text: `${month} ${day}`,
    });
  }

  return labels;
}

export function buildTimeLabels(timestampFrom, timestampTo) {
  timestampFrom = roundToHour(timestampFrom);
  timestampTo = roundToHour(timestampTo);

  const labels = [];

  for (let timestamp = timestampFrom; timestamp <= timestampTo; timestamp += HOUR_MS) {
    const date = new Date(timestamp);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();

    labels.push({
      value: timestamp,
      text: `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}`,
    });
  }

  return labels;
}

function roundToDay(timestamp) {
  return timestamp - (timestamp % DAY_MS);
}

function roundToHour(timestamp) {
  return timestamp - (timestamp % HOUR_MS);
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
