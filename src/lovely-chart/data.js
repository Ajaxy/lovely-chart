import { getMaxMin } from './utils';
import { buildDayLabels, buildTimeLabels } from './format';
import { LABELS_KEY } from './constants';

export function analyzeData(data, type) {
  const { datasets, labels } = prepareDatasets(data);

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

  const analyzed = {
    datasets,
    colors: data.colors,
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
    onZoom: data.x_on_zoom,
  };

  analyzed.shouldZoomToPie = !analyzed.onZoom && analyzed.isPercentage;
  analyzed.isZoomable = analyzed.onZoom || analyzed.shouldZoomToPie;

  return analyzed;
}

function prepareDatasets(chartData) {
  const { columns, names, types, y_scaled: hasSecondYAxis } = chartData;

  let labels = [];
  const datasets = [];

  columns.forEach((originalValues, i) => {
    const values = originalValues.slice(0);
    const key = values.shift();

    if (key === LABELS_KEY) {
      labels = values;
      return;
    }

    datasets.push({
      key,
      name: names[key],
      type: types[key],
      values,
      hasOwnYAxis: hasSecondYAxis && i === columns.length - 1,
    });
  });

  return { datasets, labels };
}
