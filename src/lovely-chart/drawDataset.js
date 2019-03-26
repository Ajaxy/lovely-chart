export function drawDataset(context, values, projection, options, bounds) {
  const { from = 0, to = values.length } = bounds || {};

  context.save();

  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'round';

  context.beginPath();

  for (let i = from; i <= to; i++) {
    const { xPx, yPx } = projection.toPixels(i, values[i]);

    if (i === 0) {
      context.moveTo(xPx, yPx);
    } else {
      context.lineTo(xPx, yPx);
    }
  }

  context.stroke();

  context.restore();
}
