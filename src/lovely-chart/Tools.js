import { createElement } from './minifiers';
import { captureEvents } from './captureEvents';

export function createTools(container, data, filterCallback) {
  let _element;

  _setupLayout();
  _updateFilter();

  function redraw() {
    if (_element) {
      const oldElement = _element;
      oldElement.classList.add('hidden');
      setTimeout(() => {
        oldElement.parentNode.removeChild(oldElement);
      }, 500);
    }

    _setupLayout();
    _element.classList.add('transparent');
    requestAnimationFrame(() => {
      _element.classList.remove('transparent');
    });
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'tools';

    if (data.datasets.length < 2) {
      _element.className += ' hidden';
    }

    data.datasets.forEach(({ key, name, colorName }) => {
      const control = createElement('a');
      control.href = '#';
      control.dataset.key = key;
      control.className = `checkbox ${colorName} checked`;
      control.innerHTML = `<span class="circle"></span><span class="label">${name}</span>`;

      control.addEventListener('click', (e) => {
        e.preventDefault();

        if (!control.dataset.clickPrevented) {
          _updateFilter(control);
        }

        delete control.dataset.clickPrevented;
      });

      captureEvents(control, {
        onLongPress: () => {
          if (!('ontouchstart' in window)) {
            control.dataset.clickPrevented = 'true';
          }

          _updateFilter(control, true);
        },
      });

      _element.appendChild(control);
    });

    container.appendChild(_element);
  }

  function _updateFilter(button, isLongPress = false) {
    const buttons = Array.from(_element.getElementsByTagName('a'));
    const isSingleChecked = _element.querySelectorAll('.checked').length === 1;

    if (button) {
      if (button.classList.contains('checked') && isSingleChecked) {
        if (isLongPress) {
          buttons.forEach((b) => b.classList.add('checked'));
          button.classList.remove('checked');
        } else {
          button.classList.remove('shake');
          requestAnimationFrame(() => {
            button.classList.add('shake');
          });
        }
      } else if (isLongPress) {
        buttons.forEach((b) => b.classList.remove('checked'));
        button.classList.add('checked');
      } else {
        button.classList.toggle('checked');
      }
    }

    const filter = {};

    buttons.forEach((input) => {
      filter[input.dataset.key] = input.classList.contains('checked');
    });

    filterCallback(filter);
  }

  return {
    redraw,
  };
}
