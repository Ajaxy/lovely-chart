export function drawDataset(context, valuesByLabelIndex, projectionFn, options) {
  context.save();

  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  // TODO perf slow?
  context.globalAlpha = options.opacity;

  // TODO perf for all
  context.beginPath();

  for (let i = 0, l = valuesByLabelIndex.length; i <= l; i++) {
    const y = valuesByLabelIndex[i];

    if (y === undefined) {
      continue;
    }

    const { xPx, yPx } = projectionFn(i, y);

    if (i === 0) {
      context.moveTo(xPx, yPx);
    } else {
      context.lineTo(xPx, yPx);
    }
  }

  context.stroke();

  context.restore();
}
