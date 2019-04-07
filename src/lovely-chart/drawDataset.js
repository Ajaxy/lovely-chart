export function drawDataset(context, values, projection, options, { from, to }) {
  context.beginPath();

  for (let i = from; i <= to; i++) {
    const [xPx, yPx] = projection.toPixels(i, values[i]);

    if (i === from) {
      context.moveTo(xPx, yPx);
    } else {
      context.lineTo(xPx, yPx);
    }
  }

  context.save();
  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'bevel';
  context.lineCap = 'butt';
  context.stroke();
  context.restore();
}
