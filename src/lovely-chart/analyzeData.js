import { getMaxMinBy, mergeArrays, toYByX } from './fast';
import { buildDayLabels, buildIntegerLabels } from './labels';

export function analyzeData(data) {
  const { datasets } = data;

  const merged = mergeArrays(datasets);
  const { min: yMin, max: yMax } = getMaxMinBy(merged, 'y');

  const firsts = datasets.map((dataset) => dataset[0]);
  const lasts = datasets.map((dataset) => dataset[dataset.length - 1]);

  const { min: xMin } = getMaxMinBy(firsts, 'x');
  const { max: xMax } = getMaxMinBy(lasts, 'x');

  const dataInfo = {
    xLabels: [],
    yMin,
    yMax,
    xMin,
    xMax,
  };

  dataInfo.xLabels = buildDayLabels(dataInfo.xMin, dataInfo.xMax);
  dataInfo.yLabels = buildIntegerLabels(dataInfo.yMin, dataInfo.yMax);

  dataInfo.datasetsByLabelIndex = datasets.map((dataset) => {
    const valuesByLabel = toYByX(dataset);
    return dataInfo.xLabels.map((label) => valuesByLabel[String(label.value)]);
  });

  return dataInfo;
}
