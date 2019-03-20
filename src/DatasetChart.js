export function drawChart(canvas, context, valuesByLabelIndex, state, options) {
  context.strokeStyle = options.color;
  context.lineWidth = 2;

  // TODO for all
  context.beginPath();

  // TODO include only edges for optimization
  // for (let i = state.labelFromIndex; i <= state.labelToIndex; i++) {
  for (let i = 0, l = valuesByLabelIndex.length; i <= l; i++) {
    const y = valuesByLabelIndex[i];

    if (y === undefined) {
      continue;
    }

    const { xPx, yPx } = state.getPixelCoords(i, y);

    if (i === 0) {
      context.moveTo(xPx, yPx);
    } else {
      context.lineTo(xPx, yPx);
    }
  }

  context.stroke();
}
