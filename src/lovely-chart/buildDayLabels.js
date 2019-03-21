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
