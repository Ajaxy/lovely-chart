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

  return {
    toPixels(labelIndex, y) {
      return [
        labelIndex * xFactor - xOffsetPx,
        availableHeight - (y * yFactor - yOffsetPx),
      ];
    },

    findClosesLabelIndex(xPx) {
      return Math.round((xPx + xOffsetPx) / xFactor);
    },

    copy(overrides) {
      return createProjection(proxyMerge(params, overrides));
    },
  };
}
