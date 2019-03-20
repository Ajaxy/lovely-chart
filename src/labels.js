const DAY_MS = 1000 * 60 * 60 * 24;

export function buildIntegerLabels(from, to) {
  const labels = [];

  for (let i = from; i <= to; i += 1) {
    labels.push({
      value: i,
      text: `${i}`
    });
  }

  return labels;
}

export function buildDayLabels(timestampFrom, timestampTo) {
  timestampFrom = roundToDay(timestampFrom);
  timestampTo = roundToDay(timestampTo);

  const labels = [];

  for (let timestamp = timestampFrom; timestamp <= timestampTo; timestamp += DAY_MS) {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = date.toLocaleString('en-us', { month: 'short' });

    labels.push({
      value: timestamp,
      text: `${month} ${day}`
    });
  }

  return labels;
}

function roundToDay(timestamp) {
  return timestamp - (timestamp % DAY_MS);
}

