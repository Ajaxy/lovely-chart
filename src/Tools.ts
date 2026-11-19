import type { AnalyzedData, ChartColors, Filter } from './types.js';

import { captureEvents } from './captureEvents.js';
import { getDrawnPattern } from './formulas.js';
import { createElement } from './minifiers.js';
import { getCssColor, isLightContentTooFaint } from './skin.js';
import { throttleWithRaf } from './utils.js';

// Matches the fade-out transition of the replaced controls
const HIDE_TIMEOUT = 500;

export class Tools {
  #container: HTMLElement;
  readonly #data: AnalyzedData;
  readonly #colors: ChartColors;
  readonly #filterCallback: (filter: Filter) => void;

  #element!: HTMLElement;
  // The controls a redraw replaced, which fade out before they leave
  #hiddenElement?: HTMLElement;
  #hideTimeout?: number;
  #captureDetachers: (() => void)[] = [];

  readonly #revealOnRaf = throttleWithRaf(() => this.#element.classList.remove('lovely-chart--state-transparent'));
  readonly #shakeOnRaf = throttleWithRaf((button: HTMLAnchorElement) => {
    button.classList.add('lovely-chart--state-shake');
  });

  // The legend takes the place of the one it replaces, before `nextSibling`, while `nextSibling` is in `container`
  constructor(
    container: HTMLElement, data: AnalyzedData, colors: ChartColors, filterCallback: (filter: Filter) => void,
    nextSibling?: Node,
  ) {
    this.#container = container;
    this.#data = data;
    this.#colors = colors;
    this.#filterCallback = filterCallback;

    this.#setupLayout(undefined, nextSibling);
    this.#updateFilter();
  }

  // Rebuilds the buttons for the datasets of a zoomed or restored view, checked as `filter` shows them
  redraw(filter: Filter) {
    this.#removeHiddenElement();
    this.#detachCaptures();
    this.#hiddenElement = this.#element;
    this.#hiddenElement.classList.add('lovely-chart--state-hidden');
    this.#hideTimeout = window.setTimeout(() => this.#removeHiddenElement(), HIDE_TIMEOUT);

    this.#setupLayout(filter);
    this.#element.classList.add('lovely-chart--state-transparent');
    this.#revealOnRaf();
  }

  // Moves the legend into `container`, where a later redraw also builds it. The controls a redraw replaced leave at
  // once, so the element that held the legend keeps nothing of it.
  setContainer(container: HTMLElement) {
    if (container === this.#container) return;
    this.#removeHiddenElement();
    this.#container = container;
    container.appendChild(this.#element);
  }

  // Paints the buttons and the comparison entry in the colours of the skin on screen
  updateColors() {
    Array.from(this.#element.getElementsByTagName('a')).forEach((button) => {
      const colorKey = `dataset#${button.dataset.key}`;
      button.style.setProperty('--lovely-chart-series-color', getCssColor(this.#colors, colorKey));
      button.classList.toggle('lovely-chart--dark-content', isLightContentTooFaint(this.#colors, colorKey));
    });

    this.#element.querySelector<HTMLElement>('.lovely-chart--comparison-legend')
      ?.style.setProperty('--lovely-chart-series-color', getCssColor(this.#colors, 'dataset#comparison'));
  }

  getElement(): HTMLElement {
    return this.#element;
  }

  // Leaves the legend in place, for the chart to remove it or fade it out
  destroy() {
    this.#removeHiddenElement();
    this.#detachCaptures();
    this.#revealOnRaf.cancel();
    this.#shakeOnRaf.cancel();
  }

  #setupLayout(filter?: Filter, nextSibling?: Node) {
    this.#element = createElement();
    this.#element.className = 'lovely-chart--tools';

    // A lone dataset needs no legend, unless it starts hidden and the legend is the way to show it,
    // or a comparison line needs its name
    const { datasets, comparison } = this.#data;
    if (datasets.length < 2 && !comparison && !datasets.some(({ isInitiallyHidden }) => isInitiallyHidden)) {
      this.#element.className += ' lovely-chart--state-hidden';
    }

    datasets.forEach((dataset) => {
      const { key, name, isInitiallyHidden } = dataset;
      const control = createElement<HTMLAnchorElement>('a');
      control.href = '#';
      control.dataset.key = key;
      const isChecked = filter?.[key] ?? !isInitiallyHidden;
      const checked = isChecked ? ' lovely-chart--state-checked' : '';
      control.className = `lovely-chart--button${checked}`;
      control.setAttribute('role', 'button');
      control.setAttribute('aria-pressed', String(isChecked));
      const pattern = getDrawnPattern(dataset);
      if (pattern) {
        control.setAttribute(`data-${pattern}`, 'true');
      }
      // A link activates on Enter alone, while a button also activates on Space
      control.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
          e.preventDefault();
          control.click();
        }
      });

      const check = createElement<HTMLSpanElement>('span');
      check.className = 'lovely-chart--button-check';
      control.appendChild(check);

      const label = createElement<HTMLSpanElement>('span');
      label.className = 'lovely-chart--button-label';
      label.textContent = name;
      control.appendChild(label);

      control.addEventListener('click', (e) => {
        e.preventDefault();

        if (!control.dataset.clickPrevented) {
          this.#updateFilter(control);
        }

        delete control.dataset.clickPrevented;
      });

      this.#captureDetachers.push(captureEvents(control, {
        onLongPress: () => {
          control.dataset.clickPrevented = 'true';

          this.#updateFilter(control, true);
        },
      }));

      this.#element.appendChild(control);
    });

    if (comparison) {
      const comparisonLegend = createElement<HTMLSpanElement>('span');
      comparisonLegend.className = 'lovely-chart--comparison-legend';
      comparisonLegend.textContent = comparison.name;
      this.#element.appendChild(comparisonLegend);
    }

    this.updateColors();
    if (nextSibling?.parentNode === this.#container) {
      this.#container.insertBefore(this.#element, nextSibling);
    } else {
      this.#container.appendChild(this.#element);
    }
  }

  #updateFilter(button?: HTMLAnchorElement, isLongPress = false) {
    const buttons = Array.from(this.#element.getElementsByTagName('a'));
    const isSingleChecked = this.#element.querySelectorAll('.lovely-chart--state-checked').length === 1;

    if (button) {
      if (button.classList.contains('lovely-chart--state-checked') && isSingleChecked) {
        if (isLongPress) {
          buttons.forEach((b) => b.classList.add('lovely-chart--state-checked'));
          button.classList.remove('lovely-chart--state-checked');
        } else {
          button.classList.remove('lovely-chart--state-shake');
          this.#shakeOnRaf(button);
        }
      } else if (isLongPress) {
        buttons.forEach((b) => b.classList.remove('lovely-chart--state-checked'));
        button.classList.add('lovely-chart--state-checked');
      } else {
        button.classList.toggle('lovely-chart--state-checked');
      }
    }

    const filter: Filter = {};

    buttons.forEach((input) => {
      const isChecked = input.classList.contains('lovely-chart--state-checked');
      filter[input.dataset.key!] = isChecked;
      input.setAttribute('aria-pressed', String(isChecked));
    });

    this.#filterCallback(filter);
  }

  #removeHiddenElement() {
    clearTimeout(this.#hideTimeout);
    this.#hideTimeout = undefined;
    this.#hiddenElement?.remove();
    this.#hiddenElement = undefined;
  }

  #detachCaptures() {
    this.#captureDetachers.forEach((detach) => detach());
    this.#captureDetachers = [];
  }
}
