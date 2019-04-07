export function createProjection(bounds, availableSize, { xPadding = 0, yPadding = 0 } = {}) {
  let width = availableSize.width;

  if (bounds.begin === 0) {
    width -= xPadding;
  }

  if (bounds.end === 1) {
    width -= xPadding;
  }

  const xFactor = width / bounds.xWidth;
  let xOffset = bounds.xOffset * xFactor;

  if (bounds.begin === 0) {
    xOffset -= xPadding;
  }

  const yFactor = (availableSize.height - yPadding) / (bounds.yMax - bounds.yMin);
  const yOffset = bounds.yMin * yFactor;

  return {
    toPixels(labelIndex, y) {
      return [
        labelIndex * xFactor - xOffset,
        availableSize.height - (y * yFactor - yOffset),
      ];
    },

    findClosesLabelIndex(xPx) {
      return Math.round((xPx + xOffset) / xFactor);
    },
  };
}
