import { getMaxMin, mergeArrays } from './fast';
import { AXES_MAX_COLUMN_WIDTH, AXES_MAX_ROW_HEIGHT, X_AXIS_HEIGHT } from './constants';

export function calculateState(dataInfo, viewportSize, range = {}, filter) {
  const { begin, end } = range;
  const totalXWidth = dataInfo.xLabels.length;
  const labelFromIndex = Math.max(0, Math.floor(totalXWidth * begin));
  const labelToIndex = Math.min(totalXWidth - 1, Math.ceil(totalXWidth * end));
  const viewportDatasets = dataInfo.datasetsByLabelIndex
    .filter((_, i) => !filter || filter[dataInfo.options[i].key])
    .map((dataset) => dataset.slice(labelFromIndex, labelToIndex));

  const merged = mergeArrays(viewportDatasets);
  const effective = merged.filter((value) => value !== undefined);
  const { max: yMax = dataInfo.yMax } = getMaxMin(effective);
  const yMin = 0; // TODO maybe needed real

  const datasetOpacity = {};

  filter && dataInfo.options.forEach(({ key }) => {
    datasetOpacity[`opacity#${key}`] = filter[key] ? 1 : 0;
  });

  return {
    xShift: begin * totalXWidth,
    xWidth: (end - begin) * totalXWidth,
    yMin,
    yMax,
    xAxisScale: calculateXAxisScale(dataInfo.xLabels.length, viewportSize.width, begin, end),
    yAxisScale: calculateYAxisScale(viewportSize.height, yMax, yMin),
    ...datasetOpacity,
  };
}

function calculateXAxisScale(labelsCount, plotWidth, begin, end) {
  const viewportPercent = end - begin;
  const viewportLabelsCount = labelsCount * viewportPercent;
  const maxColumns = Math.floor(plotWidth / AXES_MAX_COLUMN_WIDTH);
  const hiddenLabelsFactor = viewportLabelsCount / maxColumns;

  return Math.ceil(Math.log2(hiddenLabelsFactor));
}

function calculateYAxisScale(plotHeight, yMax, yMin) {
  const availableHeight = plotHeight - X_AXIS_HEIGHT;
  const viewportLabelsCount = yMax - yMin;
  const maxRows = Math.floor(availableHeight / AXES_MAX_ROW_HEIGHT);
  const hiddenLabelsFactor = viewportLabelsCount / maxRows;

  return Math.ceil(Math.sqrt(hiddenLabelsFactor / 2));
}
