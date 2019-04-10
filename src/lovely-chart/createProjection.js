import { proxyMerge } from './fast';

export function createProjection(params) {
  const {
    begin,
    end,
    xWidth,
    xOffset,
    yMin,
    yMax,
    availableWidth,
    availableHeight,
    xPadding = 0,
    yPadding = 0,
  } = params;

  let width = availableWidth;

  if (begin === 0) {
    width -= xPadding;
  }

  if (end === 1) {
    width -= xPadding;
  }

  const xFactor = width / xWidth;
  let xOffsetPx = xOffset * xFactor;

  if (begin === 0) {
    xOffsetPx -= xPadding;
  }

  const yFactor = (availableHeight - yPadding) / (yMax - yMin);
  const yOffsetPx = yMin * yFactor;

  function getX(labelIndex) {
    return labelIndex * xFactor - xOffsetPx;
  }

  function getHeight(value) {
    return value * yFactor - yOffsetPx;
  }

  function toPixels(labelIndex, value) {
    return [
      getX(labelIndex),
      availableHeight - getHeight(value),
    ];
  }

  function findClosesLabelIndex(xPx) {
    return Math.round((xPx + xOffsetPx) / xFactor);
  }

  function copy(overrides) {
    return createProjection(proxyMerge(params, overrides));
  }

  function prepareZeroBasedCoords(datasets, range) {
    const [, y0] = toPixels(0, 0);

    return datasets.map(({ values }) => {
      const coords = [];

      for (let j = range.from; j <= range.to; j++) {
        const [x, y] = toPixels(j, values[j]);

        coords.push({
          x,
          y,
          yFrom: y0,
          yTo: y,
        });
      }

      return coords;
    });
  }

  function prepareStackedCoords(datasets, range, visibilities) {
    const [, y0] = toPixels(0, 0);
    const heightsAccum = [];

    return datasets.map(({ values }, i) => {
      const coords = [];

      for (let j = range.from; j <= range.to; j++) {
        const [x] = toPixels(j, values[j]);
        const height = getHeight(values[j]);
        const visibleHeight = height * visibilities[i];

        if (heightsAccum[j] === undefined) {
          heightsAccum[j] = 0;
        }

        const yFrom = y0 - heightsAccum[j];
        const yTo = yFrom - visibleHeight;

        coords.push({ x, y: yTo, yFrom, yTo });

        heightsAccum[j] += visibleHeight;
      }

      return coords;
    });
  }

  return {
    getX,
    getHeight,
    toPixels,
    findClosesLabelIndex,
    copy,
    prepareZeroBasedCoords,
    prepareStackedCoords,
  };
}

// function calculatePercentageHeights(datasets, range, projection, visibilities) {
// const { coords, heights } = calculateHeights(datasets, range, projection, visibilities);
//
// const heightSums = sumArrays(heights);
// const percentageHeights = [];
//
// coords.forEach((datasetCoords, i) => {
//   percentageHeights[i] = [];
//
//   for (let j = range.from; j <= range.to; j++) {
//     // const percentageHeight
//     const [x] = datasetCoords[j];
//     const from = [x, y0];
//     const to = [x, y0 - heights[i][j] / heightSums[j]];
//
//     drawCoords[i].push([from, to]);
//   }
// });
//
// return coords;
// }
