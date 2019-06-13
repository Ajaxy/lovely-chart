import { getMaxMin } from './utils';
import { buildDayLabels, buildTimeLabels } from './format';

export function analyzeData(data) {
  const { title, labelType, isStacked, isPercentage, hasSecondYAxis, onZoom } = data;
  const { datasets, labels } = prepareDatasets(data);

  const colors = {};
  let totalYMin = Infinity;
  let totalYMax = -Infinity;
  datasets.forEach(({ key, color, yMin, yMax }) => {
    colors[key] = color;

    if (yMin < totalYMin) {
      totalYMin = yMin;
    }

    if (yMax > totalYMax) {
      totalYMax = yMax;
    }
  });

  const analyzed = {
    title,
    xLabels: labelType === 'hour' ? buildTimeLabels(labels) : buildDayLabels(labels),
    datasets,
    isStacked,
    isPercentage,
    hasSecondYAxis,
    onZoom,
    isLines: data.type === 'line',
    isBars: data.type === 'bar',
    isAreas: data.type === 'area',
    isPie: data.type === 'pie',
    yMin: totalYMin,
    yMax: totalYMax,
    colors,
  };

  analyzed.shouldZoomToPie = !analyzed.onZoom && analyzed.isPercentage;
  analyzed.isZoomable = analyzed.onZoom || analyzed.shouldZoomToPie;

  return analyzed;
}

function prepareDatasets(data) {
  const { type, labels, datasets, hasSecondYAxis } = data;

  return {
    labels: cloneArray(labels),
    datasets: datasets.map(({ name, color, values }, i) => {
      const { min: yMin, max: yMax } = getMaxMin(values);

      return {
        type,
        key: `y${i}`,
        name,
        color,
        values: cloneArray(values),
        hasOwnYAxis: hasSecondYAxis && i === datasets.length - 1,
        yMin,
        yMax,
      };
    }),
  };
}

function cloneArray(array) {
  return array.slice(0);
}
