import { TOOLS_CHECKBOX_HTML } from './constants';

export class Tools {
  constructor(container, dataInfo, filterCallback) {
    this._container = container;
    this._dataInfo = dataInfo;
    this._filterCallback = filterCallback;

    this._updateFilter = this._updateFilter.bind(this);

    this._setupLayout();
    this._updateFilter();
  }

  _setupLayout() {
    const element = document.createElement('div');
    element.className = 'tools';

    this._dataInfo.options.forEach(({ key, name, color }) => {
      const control = document.createElement('a');
      control.href = '#';
      control.dataset.key = key;
      control.className = 'checkbox checked';
      control.innerHTML = `<span class="circle"></span><span class="label">${name}</span>`;
      control.firstChild.style.borderColor = color;
      control.addEventListener('click', this._updateFilter);
      element.appendChild(control);
    });

    this._container.appendChild(element);
    this._element = element;
  }

  _updateFilter(e) {
    if (e) {
      e.preventDefault();

      e.currentTarget.classList.toggle('checked');
    }

    const filter = {};

    Array.from(this._element.getElementsByTagName('a')).forEach((input) => {
      filter[input.dataset.key] = input.classList.contains('checked');
    });

    this._filterCallback(filter);
  }
}
