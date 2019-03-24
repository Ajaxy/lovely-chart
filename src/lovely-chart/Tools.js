export function createTools(container, data, filterCallback) {
  const _container = container;
  const _data = data;
  const _filterCallback = filterCallback;

  let _element;

  _setupLayout();
  _updateFilter();

  function _setupLayout() {
    _element = document.createElement('div');
    _element.className = 'tools';

    _data.datasets.forEach(({ key, name, color }) => {
      const control = document.createElement('a');
      control.href = '#';
      control.dataset.key = key;
      control.className = 'checkbox checked';
      control.innerHTML = `<span class="circle"></span><span class="label">${name}</span>`;
      control.firstChild.style.borderColor = color;
      control.addEventListener('click', _updateFilter);
      _element.appendChild(control);
    });

    _container.appendChild(_element);
  }

  function _updateFilter(e) {
    if (e) {
      e.preventDefault();
      e.currentTarget.classList.toggle('checked');
    }

    const filter = {};

    Array.from(_element.getElementsByTagName('a')).forEach((input) => {
      filter[input.dataset.key] = input.classList.contains('checked');
    });

    _filterCallback(filter);
  }
}
