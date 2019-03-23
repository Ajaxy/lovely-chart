export function createProjection(bounds, availableSize, { leftMargin = 0 } = {}) {
  const xFactor = availableSize.width / bounds.xWidth;
  const xOffset = bounds.xOffset * xFactor;
  const yFactor = availableSize.height / bounds.yMax;
  const yOffset = bounds.yMin * yFactor;

  return {
    toPixels(labelIndex, y) {
      return {
        xPx: labelIndex * xFactor - xOffset + leftMargin,
        yPx: availableSize.height - (y * yFactor - yOffset),
      };
    },

    findClosesLabelIndex(xPx) {
      return Math.round((xPx - leftMargin + xOffset) / xFactor);
    },
  };
}
