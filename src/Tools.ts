import type { AnalyzedData, Filter } from './types';

import { captureEvents } from './captureEvents';
import { createElement } from './minifiers';
import { isColorCloseToWhite } from './skin';

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

  redraw() {
    const oldElement = this.#element;
    oldElement.classList.add('lovely-chart--state-hidden');
    setTimeout(() => {
      oldElement.parentNode!.removeChild(oldElement);
    }, HIDE_TIMEOUT);

    this.#setupLayout();
    this.#element.classList.add('lovely-chart--state-transparent');
    requestAnimationFrame(() => {
      this.#element.classList.remove('lovely-chart--state-transparent');
    });
  }

  #setupLayout() {
    this.#element = createElement();
    this.#element.className = 'lovely-chart--tools';

    if (this.#data.datasets.length < 2) {
      this.#element.className += ' lovely-chart--state-hidden';
    }

    this.#data.datasets.forEach(({ key, name }) => {
      const color = this.#data.colors[key];
      const control = createElement<HTMLAnchorElement>('a');
      control.href = '#';
      control.dataset.key = key;
      const darkContent = isColorCloseToWhite(color) ? ' lovely-chart--dark-content' : '';
      control.className = `lovely-chart--button lovely-chart--color-${color.slice(1)}`
        + ` lovely-chart--state-checked${darkContent}`;

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
      filter[input.dataset.key!] = input.classList.contains('lovely-chart--state-checked');
    });

    this.#filterCallback(filter);
  }
}
