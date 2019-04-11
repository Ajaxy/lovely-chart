import { proxyMerge, sumArrays } from './fast';

export function createProjection(params) {
  const {
    begin,
    end,
    totalXWidth,
    yMin,
    yMax,
    availableWidth,
    availableHeight,
    xPadding = 0,
    yPadding = 0,
  } = params;

  const xOffset = begin * totalXWidth;
  const xWidth = (end - begin) * totalXWidth;

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

  function prepareCoords(datasets, range) {
    const [, y0] = toPixels(0, 0);

    return datasets.map(({ values }) => {
      const coords = [];

      for (let j = range.from; j <= range.to; j++) {
        const [x, y] = toPixels(j, values[j]);
        const height = y0 - y;

        coords.push({
          x,
          y,
          yFrom: y0,
          yTo: y,
          height,
          heightPercent: height / (availableHeight - yPadding),
        });
      }

      return coords;
    });
  }

  return {
    // TODO maybe not needed
    // getX,
    // getHeight,
    toPixels,
    findClosesLabelIndex,
    copy,
    prepareCoords,
  };
}

export function setStacked(coords, visibilities) {
  const heightsAccum = [];

  return coords.map((datasetCoords, i) => {
    return datasetCoords.map(({ x, yFrom, height }, j) => {
      const visibleHeight = height * visibilities[i];

      if (heightsAccum[j] === undefined) {
        heightsAccum[j] = 0;
      }

      yFrom -= heightsAccum[j];
      const yTo = yFrom - visibleHeight;

      heightsAccum[j] += visibleHeight;

      return {
        x,
        y: yTo,
        height: visibleHeight,
        yFrom,
        yTo,
      };
    });
  });
}

export function setPercentage(coords, visibilities) {
  const heights = coords.map((datasetCoords, i) => datasetCoords.map(({ height }) => height * visibilities[i]));
  const heightSums = sumArrays(heights);

  return coords.map((datasetCoords, i) => {
    return datasetCoords.map(({ x, height, heightPercent, yFrom }, j) => {
      const maxH = height / heightPercent;
      const relativeHeight = maxH * (height / heightSums[j]);
      const yTo = yFrom + relativeHeight;

      return {
        x,
        y: yTo,
        height: relativeHeight,
        yFrom,
        yTo,
      };
    });
  });
}
