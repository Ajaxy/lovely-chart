import { simplify } from './simplify';

export function drawDataset(context, values, projection, options, bounds, simplifierDelta) {
  const { from = 0, to = values.length } = bounds || {};

  const pixels = [];
  for (let i = from; i <= to; i++) {
    const { xPx, yPx } = projection.toPixels(i, values[i]);
    pixels.push([xPx, yPx]);
  }

  const simplifierFn = simplify(pixels);
  const { points: simplifiedPixels } = simplifierFn(simplifierDelta);

  context.save();

  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'round';

  context.beginPath();

  simplifiedPixels.forEach(([xPx, yPx], i) => {
    if (i === 0) {
      context.moveTo(xPx, yPx);
    } else {
      context.lineTo(xPx, yPx);
    }
  });

  context.stroke();

  context.restore();
}
