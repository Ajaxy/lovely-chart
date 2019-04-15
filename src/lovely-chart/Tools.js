import { createElement } from './minifiers';

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
      control.addEventListener('click', _updateFilter);
      _element.appendChild(control);
    });

    container.appendChild(_element);
  }

  function _updateFilter(e) {
    if (e) {
      e.preventDefault();
      const button = e.currentTarget;

      if (button.classList.contains('checked') && _element.querySelectorAll('.checked').length < 2) {
        button.removeAttribute('style');
        window.requestAnimationFrame(() => button.style = 'animation-name: shake;');
      } else {
        button.classList.toggle('checked');
      }
    }

    const filter = {};

    Array.from(_element.getElementsByTagName('a')).forEach((input) => {
      filter[input.dataset.key] = input.classList.contains('checked');
    });

    filterCallback(filter);
  }

  return {
    redraw,
  };
}
