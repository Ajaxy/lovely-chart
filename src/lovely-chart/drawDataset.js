import { simplify } from './simplify';
import { SIMPLIFIER_MIN_POINTS } from './constants';

export function drawDataset(context, values, projection, options, bounds, simplifierDelta) {
  const { from = 0, to = values.length } = bounds || {};

  let pixels = [];
  for (let i = from; i <= to; i++) {
    const { xPx, yPx } = projection.toPixels(i, values[i]);
    pixels.push([xPx, yPx]);
  }

  if (pixels.length >= SIMPLIFIER_MIN_POINTS) {
    const simplifierFn = simplify(pixels);
    pixels = simplifierFn(simplifierDelta).points;
  }

  context.save();

  context.strokeStyle = options.color;
  context.lineWidth = options.lineWidth;
  context.globalAlpha = options.opacity;
  context.lineJoin = 'round';

  context.beginPath();

  pixels.forEach(([xPx, yPx], i) => {
    if (i === 0) {
      context.moveTo(xPx, yPx);
    } else {
      context.lineTo(xPx, yPx);
    }
  });

  context.stroke();

  context.restore();
}
