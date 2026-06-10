import { createElement, addEventListener } from './minifiers.js';
import { toggleText } from './toggleText.js';
import { throttle } from './utils.js';

export class Header {
  #container;
  #title;
  #zoomOutLabel;
  #zoomOutCallback;

  #element;
  #titleElement;
  #zoomOutElement;
  #captionElement;
  #isZooming;
  #zoomBindTimeout = null;

  setCaption = throttle((caption) => this.#setCaption(caption), 100, false);

  constructor(container, title, zoomOutLabel = 'Zoom out', zoomOutCallback) {
    this.#container = container;
    this.#title = title;
    this.#zoomOutLabel = zoomOutLabel;
    this.#zoomOutCallback = zoomOutCallback;

    this.#setupLayout();
  }

  zoom(caption) {
    this.#zoomOutElement = toggleText(this.#titleElement, this.#zoomOutLabel, 'lovely-chart--header-title lovely-chart--header-zoom-out-control');
    this.#zoomBindTimeout = setTimeout(() => {
      this.#zoomBindTimeout = null;
      addEventListener(this.#zoomOutElement, 'click', this.#onZoomOut);
    }, 500);

    this.#setCaption(caption);
  }

  destroy() {
    if (this.#zoomBindTimeout !== null) {
      clearTimeout(this.#zoomBindTimeout);
      this.#zoomBindTimeout = null;
    }
  }

  toggleIsZooming(isZooming) {
    this.#isZooming = isZooming;
  }

  #setCaption(caption) {
    if (this.#isZooming) {
      return;
    }

    this.#captionElement.textContent = caption;
  }

  #setupLayout() {
    this.#element = createElement();
    this.#element.className = 'lovely-chart--header';

    this.#titleElement = createElement();
    this.#titleElement.className = 'lovely-chart--header-title';
    this.#titleElement.textContent = this.#title;
    this.#element.appendChild(this.#titleElement);

    this.#captionElement = createElement();
    this.#captionElement.className = 'lovely-chart--header-caption lovely-chart--position-right';
    this.#element.appendChild(this.#captionElement);

    this.#container.appendChild(this.#element);
  }

  #onZoomOut = () => {
    this.#titleElement = toggleText(this.#zoomOutElement, this.#title, 'lovely-chart--header-title', true);
    this.#titleElement.classList.remove('lovely-chart--transition');

    this.#zoomOutCallback();
  };
}
