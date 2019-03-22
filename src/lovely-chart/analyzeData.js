import { getMaxMinBy, mergeArrays, toYByX } from './fast';
import { buildDayLabels } from './buildDayLabels';

// TODO Use original data
export function analyzeData(data) {
  const { datasets, options } = data;

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
    options
  };

  dataInfo.xLabels = buildDayLabels(dataInfo.xMin, dataInfo.xMax);

  dataInfo.datasetsByLabelIndex = datasets.map((dataset) => {
    const valuesByLabel = toYByX(dataset);
    return dataInfo.xLabels.map((label) => valuesByLabel[String(label.value)]);
  });

  return dataInfo;
}
