import type { Size } from './types.js';

import { DPR, HALO_WIDTH, REFERENCE_LINE_DASH } from './constants.js';
import { createElement } from './minifiers.js';

const RULE_WIDTH = 1;
const HALF_PIXEL = 0.5;

export function setupCanvas(container: HTMLElement, { width, height }: Size) {
  const canvas = createElement<HTMLCanvasElement>('canvas');

  canvas.width = width * DPR;
  canvas.height = height * DPR;
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;

  const context = canvas.getContext('2d')!;
  context.scale(DPR, DPR);

  container.appendChild(canvas);

  return { canvas, context };
}

// An outline of the background colour keeps a label over the plot legible across lines and bars
export function drawHalo(context: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  context.save();
  context.lineWidth = HALO_WIDTH;
  context.lineJoin = 'round';
  context.strokeStyle = color;
  context.strokeText(text, x, y);
  context.restore();
}

// A 1px rule on the pixel grid stays sharp
export function drawDashedRule(
  context: CanvasRenderingContext2D, x: number, top: number, bottom: number, color: string,
) {
  const pixelX = Math.round(x) + HALF_PIXEL;
  context.save();
  context.lineWidth = RULE_WIDTH;
  context.setLineDash(REFERENCE_LINE_DASH);
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(pixelX, top);
  context.lineTo(pixelX, bottom);
  context.stroke();
  context.restore();
}

export function clearCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  context.clearRect(0, 0, canvas.width, canvas.height);
}
