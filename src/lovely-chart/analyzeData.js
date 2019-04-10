import { ensureSorted, getMaxMin } from './fast';
import { buildDayLabels } from './format';
import { LABELS_KEY } from './constants';

function prepareDatasets(chartData) {
  const { columns, names, colors, types, y_scaled: hasSecondYAxis } = chartData;

  let labels = [];
  const datasets = [];

  columns.forEach((values, i) => {
    const key = values.shift();

    if (key === LABELS_KEY) {
      labels = values;
      ensureSorted(labels);
      return;
    }

    datasets.push({
      key,
      color: colors[key],
      name: names[key],
      type: types[key],
      values,
      hasOwnYAxis: hasSecondYAxis && i === columns.length - 1,
    });
  });

  datasets.forEach((dataset) => {
    dataset.labels = labels;
  });

  return { datasets };
}

export function analyzeData(data) {
  const { datasets } = prepareDatasets(data);

  let totalYMin = Infinity;
  let totalYMax = -Infinity;

  datasets.forEach((dataset) => {
    const { max: yMax } = getMaxMin(dataset.values);
    const yMin = 0;

    if (yMin < totalYMin) {
      totalYMin = yMin;
    }

    if (yMax > totalYMax) {
      totalYMax = yMax;
    }

    dataset.yMin = yMin;
    dataset.yMax = yMax;
  });

  const firstlLabels = datasets.map((dataset) => dataset.labels[0]);
  const lastLabels = datasets.map((dataset) => dataset.labels[dataset.labels.length - 1]);
  const firstDate = Math.min.apply(null, firstlLabels);
  const lastDate = Math.max.apply(null, lastLabels);
  const xLabels = buildDayLabels(firstDate, lastDate);

  return {
    datasets,
    yMin: totalYMin,
    yMax: totalYMax,
    xLabels,
    hasSecondYAxis: data.y_scaled,
    isStacked: data.stacked,
  };
}
