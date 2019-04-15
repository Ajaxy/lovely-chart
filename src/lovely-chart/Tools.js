import { createElement } from './minifiers';

export function createTools(container, data, filterCallback) {
  if (data.datasets.length < 2) {
    return;
  }

  let _element;

  _setupLayout();
  _updateFilter();

  function _setupLayout() {
    _element = createElement();
    _element.className = 'tools';

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
        button.classList.remove('shake');
        window.requestAnimationFrame(() => button.classList.add('shake'));
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
}
