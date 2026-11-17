import type { AnalyzedData, Filter } from './types.js';

import { captureEvents } from './captureEvents.js';
import { createElement } from './minifiers.js';
import { isLightContentTooFaint } from './skin.js';

// Matches the fade-out transition of the replaced controls
const HIDE_TIMEOUT = 500;

export class Tools {
  readonly #container: HTMLElement;
  readonly #data: AnalyzedData;
  readonly #filterCallback: (filter: Filter) => void;

  #element!: HTMLElement;

  constructor(container: HTMLElement, data: AnalyzedData, filterCallback: (filter: Filter) => void) {
    this.#container = container;
    this.#data = data;
    this.#filterCallback = filterCallback;

    this.#setupLayout();
    this.#updateFilter();
  }

  // Rebuilds the buttons for the datasets of a zoomed or restored view, checked as `filter` shows them
  redraw(filter: Filter) {
    const oldElement = this.#element;
    oldElement.classList.add('lovely-chart--state-hidden');
    setTimeout(() => {
      oldElement.remove();
    }, HIDE_TIMEOUT);

    this.#setupLayout(filter);
    this.#element.classList.add('lovely-chart--state-transparent');
    requestAnimationFrame(() => {
      this.#element.classList.remove('lovely-chart--state-transparent');
    });
  }

  destroy() {
    this.#element.remove();
  }

  #setupLayout(filter?: Filter) {
    this.#element = createElement();
    this.#element.className = 'lovely-chart--tools';

    // A lone dataset needs no legend, unless it starts hidden and the legend is the way to show it
    const { datasets } = this.#data;
    if (datasets.length < 2 && !datasets.some(({ isInitiallyHidden }) => isInitiallyHidden)) {
      this.#element.className += ' lovely-chart--state-hidden';
    }

    datasets.forEach(({ key, name, isInitiallyHidden }) => {
      const color = this.#data.colors[key];
      const control = createElement<HTMLAnchorElement>('a');
      control.href = '#';
      control.dataset.key = key;
      const darkContent = isLightContentTooFaint(color) ? ' lovely-chart--dark-content' : '';
      const isChecked = filter?.[key] ?? !isInitiallyHidden;
      const checked = isChecked ? ' lovely-chart--state-checked' : '';
      control.className = `lovely-chart--button lovely-chart--color-${color.slice(1)}${checked}${darkContent}`;
      control.setAttribute('role', 'button');
      control.setAttribute('aria-pressed', String(isChecked));
      control.style.setProperty('--lovely-chart-series-color', color);
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

      captureEvents(control, {
        onLongPress: () => {
          control.dataset.clickPrevented = 'true';

          this.#updateFilter(control, true);
        },
      });

      this.#element.appendChild(control);
    });

    this.#container.appendChild(this.#element);
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
          requestAnimationFrame(() => {
            button.classList.add('lovely-chart--state-shake');
          });
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
}
