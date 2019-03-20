// TODO extract to constants.js
const X_SCALE_HEIGHT = 30;

export function createProjectionFn(viewportData, canvasSize) {
  const xFactor = canvasSize.width / viewportData.xWidth;
  const xShift = viewportData.xShift * xFactor;

  const availableCanvasHeight = canvasSize.height - X_SCALE_HEIGHT;
  const yFactor = availableCanvasHeight / viewportData.yMax;
  const yShift = viewportData.yMin * yFactor;

  return function (labelIndex, y) {
    // TODO perf test w/o `round`
    return {
      xPx: Math.round(labelIndex * xFactor - xShift),
      yPx: Math.round(availableCanvasHeight - (y * yFactor - yShift)),
    };
  };
}
