
// TODO is needed?
// TODO analyze complexity
export function getBoundsForDatasets(datasets) {
  const dataInfo = {
    xMax: 0,
    xMin: Infinity,
    yMax: 0,
    yMin: Infinity,
    byDataset: [],
  };

  datasets.forEach((dataset) => {
    const { max: xMax, min: xMin } = getMaxMinBy(dataset, 'x');
    const { max: yMax, min: yMin } = getMaxMinBy(dataset, 'y');

    dataInfo.byDataset.push({ xMax, xMin, yMax, yMin });

    if (xMax > dataInfo.xMax) {
      dataInfo.xMax = xMax;
    }
    if (xMin < dataInfo.xMin) {
      dataInfo.xMin = xMin;
    }
    if (yMax > dataInfo.yMax) {
      dataInfo.yMax = yMax;
    }
    if (yMin < dataInfo.yMin) {
      dataInfo.yMin = yMin;
    }
  });

  return dataInfo;
}
