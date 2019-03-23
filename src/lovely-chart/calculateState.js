import { getMaxMin, mergeArrays } from './fast';
import { AXES_MAX_COLUMN_WIDTH, AXES_MAX_ROW_HEIGHT, X_AXIS_HEIGHT } from './constants';

export function calculateState(data, viewportSize, range = {}, filter) {
  const { begin, end } = range;
  const totalXWidth = data.xLabels.length;
  const labelFromIndex = Math.max(0, Math.floor(totalXWidth * begin));
  const labelToIndex = Math.min(totalXWidth - 1, Math.ceil(totalXWidth * end));

  const filteredDatasets = filter ? data.datasets.filter(({ key }) => filter[key]) : data.datasets;
  const filteredValues = filteredDatasets.map(({ values }) => values);
  const viewportValues = filteredValues.map((values) => values.slice(labelFromIndex, labelToIndex));

  const { min: yMinTotal = 0, max: yMaxTotal = data.yMax } = getMaxMin(mergeArrays(filteredValues));
  const { max: yMaxViewport = data.yMax } = getMaxMin(mergeArrays(viewportValues));
  const yMinViewport = 0; // TODO maybe needed real

  const datasetsOpacity = {};

  if (filter) {
    data.datasets.forEach(({ key }) => {
      datasetsOpacity[`opacity#${key}`] = filter[key] ? 1 : 0;
    });
  }

  return {
    xShift: begin * totalXWidth,
    xWidth: (end - begin) * totalXWidth,
    yMinTotal,
    yMaxTotal,
    yMin: yMinViewport,
    yMax: yMaxViewport,
    xAxisScale: calculateXAxisScale(data.xLabels.length, viewportSize.width, begin, end),
    yAxisScale: calculateYAxisScale(viewportSize.height, yMinViewport, yMaxViewport),
    ...datasetsOpacity,
  };
}

function calculateXAxisScale(labelsCount, plotWidth, begin, end) {
  const viewportPercent = end - begin;
  const viewportLabelsCount = labelsCount * viewportPercent;
  const maxColumns = Math.floor(plotWidth / AXES_MAX_COLUMN_WIDTH);
  const hiddenLabelsFactor = viewportLabelsCount / maxColumns;

  return Math.ceil(Math.log2(hiddenLabelsFactor));
}

function calculateYAxisScale(plotHeight, yMin, yMax) {
  const availableHeight = plotHeight - X_AXIS_HEIGHT;
  const viewportLabelsCount = yMax - yMin;
  const maxRows = Math.floor(availableHeight / AXES_MAX_ROW_HEIGHT);
  const hiddenLabelsFactor = viewportLabelsCount / maxRows;

  return Math.ceil(Math.sqrt(hiddenLabelsFactor / 2));
}
