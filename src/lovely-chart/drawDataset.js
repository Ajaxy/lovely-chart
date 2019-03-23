export function drawDataset(context, values, projection, options) {
  context.save();

  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  // TODO perf slow?
  context.globalAlpha = options.opacity;

  context.beginPath();

  for (let i = 0, l = values.length; i <= l; i++) {
    const y = values[i];

    if (y === undefined) {
      continue;
    }

    const { xPx, yPx } = projection.toPixels(i, y);

    if (i === 0) {
      context.moveTo(xPx, yPx);
    } else {
      context.lineTo(xPx, yPx);
    }
  }

  context.stroke();

  context.restore();
}
