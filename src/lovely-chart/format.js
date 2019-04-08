import { DAY_MS, MONTHS } from './constants';

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

function roundToDay(timestamp) {
  return timestamp - (timestamp % DAY_MS);
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
