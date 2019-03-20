import { getMaxMin, mergeArrays } from './fast';

export function calculateState(dataInfo, range = {}) {
  const { begin = 0, end = 1 } = range;
  const totalXWidth = dataInfo.xLabels.length;
  const labelFromIndex = Math.max(0, Math.floor(totalXWidth * begin));
  const labelToIndex = Math.min(totalXWidth - 1, Math.ceil(totalXWidth * end));
  const viewportDatasets = dataInfo.datasetsByLabelIndex.map((dataset) => dataset.slice(labelFromIndex, labelToIndex));
  const merged = mergeArrays(viewportDatasets);
  const effective = merged.filter((value) => value !== undefined);
  const { max: yMax } = getMaxMin(effective);
  const yMin = 0; // TODO maybe needed real

  return {
    xShift: begin * totalXWidth,
    xWidth: (end - begin) * totalXWidth,
    yMin,
    yMax,
    yHeight: yMax - yMin,
  };
}
