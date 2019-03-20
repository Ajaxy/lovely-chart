export function createProjectionFn(state, availableSize) {
  const xFactor = availableSize.width / state.xWidth;
  const xShift = state.xShift * xFactor;

  const yFactor = availableSize.height / state.yMax;
  const yShift = state.yMin * yFactor;

  return function (labelIndex, y) {
    // TODO perf test w/o `round`
    return {
      xPx: Math.round(labelIndex * xFactor - xShift),
      yPx: Math.round(availableSize.height - (y * yFactor - yShift)),
    };
  };
}
