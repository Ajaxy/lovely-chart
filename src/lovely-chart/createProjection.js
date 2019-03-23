export function createProjection(bounds, availableSize) {
  const xFactor = availableSize.width / bounds.xWidth;
  const xShift = bounds.xShift * xFactor;

  const yFactor = availableSize.height / bounds.yMax;
  const yShift = bounds.yMin * yFactor;

  return {
    toPixels(labelIndex, y) {
      return {
        xPx: labelIndex * xFactor - xShift,
        yPx: availableSize.height - (y * yFactor - yShift),
      };
    },

    findClosesLabelIndex(xPx) {
      return Math.round((xPx + xShift) / xFactor);
    },
  };
}
