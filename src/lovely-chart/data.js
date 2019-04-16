import { getMaxMin } from './fast';
import { buildDayLabels, buildTimeLabels } from './format';
import { LABELS_KEY } from './constants';

export function fetchData(params) {
  const { data, dataSource } = params;

  if (data) {
    return Promise.resolve(data);
  } else if (dataSource) {
    return fetch(`${dataSource}/overview.json`)
      .then((response) => response.json());
  }
}

export function analyzeData(data, datasetColors, type) {
  const { datasets, labels } = prepareDatasets(data, datasetColors);

  let totalYMin = Infinity;
  let totalYMax = -Infinity;

  datasets.forEach((dataset) => {
    const { min: yMin, max: yMax } = getMaxMin(dataset.values);

    if (yMin < totalYMin) {
      totalYMin = yMin;
    }

    if (yMax > totalYMax) {
      totalYMax = yMax;
    }

    dataset.yMin = yMin;
    dataset.yMax = yMax;
  });

  return {
    datasets,
    yMin: totalYMin,
    yMax: totalYMax,
    xLabels: type === 'hours' ? buildTimeLabels(labels) : buildDayLabels(labels),
    hasSecondYAxis: data.y_scaled,
    isStacked: data.stacked,
    isPercentage: data.percentage,
    isPie: data.pie,
    isLines: datasets.some(({ type }) => type === 'line'),
    isBars: datasets.some(({ type }) => type === 'bar'),
    isAreas: datasets.some(({ type }) => type === 'area'),
  };
}

function prepareDatasets(chartData, datasetColors = {}) {
  const { columns, names, types, y_scaled: hasSecondYAxis } = chartData;

  let labels = [];
  const datasets = [];

  columns.forEach((values, i) => {
    const key = values.shift();

    if (key === LABELS_KEY) {
      labels = values;
      return;
    }

    datasets.push({
      key,
      colorName: datasetColors[key],
      name: names[key],
      type: types[key],
      values,
      hasOwnYAxis: hasSecondYAxis && i === columns.length - 1,
    });
  });

  return { datasets, labels };
}
