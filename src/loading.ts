import type { AnalyzedData, Rect } from './types.js';

import { DONUT_INNER_RADIUS_FACTOR } from './constants.js';

const SKELETON_COLOR_PROPERTY = '--skeleton-color';
// The rounding of the minimap, which the skeleton of the plot shares
const SKELETON_RADIUS = 6;

// A loading chart and its legend take no input, and dim the data on screen or show a skeleton in place of data with no
// labels
export function applyLoading(element: HTMLElement, { xLabels, isLoading = false }: AnalyzedData) {
  element.classList.toggle('lovely-chart--state-loading', isLoading && xLabels.length > 0);
  element.classList.toggle('lovely-chart--state-skeleton', isLoading && !xLabels.length);
  element.inert = isLoading;
}

// The skeleton of the plot fills its data area, or the circle of a pie or the ring of a donut
export function drawPlotSkeleton(context: CanvasRenderingContext2D, { isCircle, isDonut }: AnalyzedData, area: Rect) {
  context.fillStyle = getComputedStyle(context.canvas).getPropertyValue(SKELETON_COLOR_PROPERTY);
  context.beginPath();
  if (isCircle) {
    const radius = area.width / 2;
    const x = area.left + radius;
    const y = area.top + radius;
    context.arc(x, y, radius, 0, Math.PI * 2);
    if (isDonut) {
      context.arc(x, y, radius * DONUT_INNER_RADIUS_FACTOR, 0, Math.PI * 2, true);
    }
  } else if (typeof context.roundRect === 'function') {
    context.roundRect(area.left, area.top, area.width, area.height, SKELETON_RADIUS);
  } else {
    // Safari before 16 and Firefox before 112 lack `roundRect`
    context.rect(area.left, area.top, area.width, area.height);
  }
  context.fill();
}
