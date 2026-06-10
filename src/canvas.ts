import type { Size } from './types';

import { DPR } from './constants';
import { createElement } from './minifiers';

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

export function clearCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  context.clearRect(0, 0, canvas.width, canvas.height);
}
