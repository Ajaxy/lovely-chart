import { createElement } from './minifiers.js';
import { captureEvents } from './captureEvents.js';
import { isColorCloseToWhite } from './skin.js';

export class Tools {
  #container;
  #data;
  #filterCallback;

  #element;

  constructor(container, data, filterCallback) {
    this.#container = container;
    this.#data = data;
    this.#filterCallback = filterCallback;

    this.#setupLayout();
    this.#updateFilter();
  }

  redraw() {
    if (this.#element) {
      const oldElement = this.#element;
      oldElement.classList.add('lovely-chart--state-hidden');
      setTimeout(() => {
        oldElement.parentNode.removeChild(oldElement);
      }, 500);
    }

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
      const control = createElement('a');
      control.href = '#';
      control.dataset.key = key;
      const darkContent = isColorCloseToWhite(this.#data.colors[key]) ? ' lovely-chart--dark-content' : '';
      control.className = `lovely-chart--button lovely-chart--color-${this.#data.colors[key].slice(1)} lovely-chart--state-checked${darkContent}`;

      const check = createElement('span');
      check.className = 'lovely-chart--button-check';
      control.appendChild(check);

      const label = createElement('span');
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

  #updateFilter(button, isLongPress = false) {
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

    const filter = {};

    buttons.forEach((input) => {
      filter[input.dataset.key] = input.classList.contains('lovely-chart--state-checked');
    });

    this.#filterCallback(filter);
  }
}
