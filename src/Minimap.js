export class Minimap {
  constructor() {
  }

  getElement() {
    if (!this._element) {
      this._element = document.createElement('div');
      div.className = 'minimap';
    }
  }
}
