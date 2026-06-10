import { addEventListener, createElement } from './minifiers';
import { toggleText } from './toggleText';
import { throttle } from './utils';

export class Header {
  #container: HTMLElement;
  #title: string;
  #zoomOutLabel: string;
  #zoomOutCallback: () => void;

  #element!: HTMLElement;
  #titleElement!: HTMLElement;
  #zoomOutElement?: HTMLElement;
  #captionElement!: HTMLElement;
  #isZooming?: boolean;
  #zoomBindTimeout?: number;

  setCaption = throttle((caption: string) => this.#setCaption(caption), 100, false);

  constructor(container: HTMLElement, title: string, zoomOutLabel = 'Zoom out', zoomOutCallback: () => void) {
    this.#container = container;
    this.#title = title;
    this.#zoomOutLabel = zoomOutLabel;
    this.#zoomOutCallback = zoomOutCallback;

    this.#setupLayout();
  }

  zoom(caption: string) {
    this.#zoomOutElement = toggleText(
      this.#titleElement, this.#zoomOutLabel, 'lovely-chart--header-title lovely-chart--header-zoom-out-control',
    );
    this.#zoomBindTimeout = window.setTimeout(() => {
      this.#zoomBindTimeout = undefined;
      addEventListener(this.#zoomOutElement!, 'click', this.#onZoomOut);
    }, 500);

    this.#setCaption(caption);
  }

  destroy() {
    if (this.#zoomBindTimeout !== undefined) {
      clearTimeout(this.#zoomBindTimeout);
      this.#zoomBindTimeout = undefined;
    }
  }

  toggleIsZooming(isZooming: boolean) {
    this.#isZooming = isZooming;
  }

  #setCaption(caption: string) {
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
    this.#titleElement = toggleText(this.#zoomOutElement!, this.#title, 'lovely-chart--header-title', true);
    this.#titleElement.classList.remove('lovely-chart--transition');

    this.#zoomOutCallback();
  };
}
