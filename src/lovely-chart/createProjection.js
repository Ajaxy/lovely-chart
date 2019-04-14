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

  let effectiveWidth = availableWidth;
  if (begin === 0) {
    effectiveWidth -= xPadding;
  }
  if (end === 1) {
    effectiveWidth -= xPadding;
  }
  const xFactor = effectiveWidth / ((end - begin) * totalXWidth);
  let xOffsetPx = (begin * totalXWidth) * xFactor;
  if (begin === 0) {
    xOffsetPx -= xPadding;
  }

  const effectiveHeight = availableHeight - yPadding;
  const yFactor = effectiveHeight / (yMax - yMin);
  const yOffsetPx = yMin * yFactor;

  function toPixels(labelIndex, value) {
    return [
      labelIndex * xFactor - xOffsetPx,
      availableHeight - (value * yFactor - yOffsetPx),
    ];
  }

  function findClosesLabelIndex(xPx) {
    return Math.round((xPx + xOffsetPx) / xFactor);
  }

  function copy(overrides) {
    return createProjection(proxyMerge(params, overrides));
  }

  function prepareCoords(datasets, range) {
    return datasets.map(({ values }) => {
      const coords = [];

      for (let j = range.from; j <= range.to; j++) {
        const [x, y] = toPixels(j, values[j]);
        // TODO perf use flat
        // const [x, y] = [
        //   j * xFactor - xOffsetPx,
        //   availableHeight - (values[j] * yFactor - yOffsetPx),
        // ];
        const height = availableHeight - y;

        coords.push({
          x,
          y,
          yFrom: availableHeight,
          yTo: y,
          height,
        });
      }

      return coords;
    });
  }

  function getCenter() {
    return [
      effectiveWidth / 2,
      availableHeight - effectiveHeight / 2,
    ];
  }

  function getSize() {
    return [effectiveWidth, effectiveHeight];
  }

  function getY0() {
    return availableHeight;
  }

  return {
    toPixels,
    findClosesLabelIndex,
    copy,
    prepareCoords,
    getCenter,
    getSize,
    getY0,
  };
}

export function setPercentage(coords, visibilities, projection) {
  const heights = coords.map((datasetCoords, i) => datasetCoords.map(({ height }) => height * visibilities[i]));
  const heightSums = sumArrays(heights);
  const [, effectiveHeight] = projection.getSize();

  return coords.map((datasetCoords) => {
    return datasetCoords.map((coord, j) => {
      const { height, yFrom } = coord;
      const heightPercent = height / heightSums[j];
      const newHeight = effectiveHeight * heightPercent;
      const yTo = yFrom - newHeight;

      return Object.assign(coord, {
        y: yTo,
        height: newHeight,
        yTo,
      });
    });
  });
}

export function setStacked(coords, visibilities, projection) {
  const [, effectiveHeight] = projection.getSize();
  const y0 = projection.getY0();
  const heightsAccum = [];

  return coords.map((datasetCoords, i) => {
    return datasetCoords.map((coord, j) => {
      const { yFrom, height } = coord;
      const visibleHeight = height * visibilities[i];

      if (heightsAccum[j] === undefined) {
        heightsAccum[j] = 0;
      }

      const newYFrom = yFrom - heightsAccum[j];
      const yTo = newYFrom - visibleHeight;

      const percent = visibleHeight / effectiveHeight;
      const percentFrom = (y0 - newYFrom) / effectiveHeight;
      const percentTo = (y0 - yTo) / effectiveHeight;

      heightsAccum[j] += visibleHeight;

      return Object.assign(coord, {
        y: yTo,
        height: visibleHeight,
        yFrom: newYFrom,
        yTo,
        percent,
        percentFrom,
        percentTo,
      });
    });
  });
}
