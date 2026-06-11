import { addEventListener, createElement } from './minifiers';
import { toggleText } from './toggleText';
import { throttle } from './utils';

const CAPTION_THROTTLE_MS = 100;
// Matches the title slide-in transition, so the link is not clickable mid-animation
const ZOOM_OUT_BIND_DELAY = 500;

export class Header {
  readonly #container: HTMLElement;
  readonly #title: string;
  readonly #zoomOutLabel: string;
  readonly #zoomOutCallback: () => void;

  #element!: HTMLElement;
  #titleElement!: HTMLElement;
  #zoomOutElement?: HTMLElement;
  #captionElement!: HTMLElement;
  #isZooming?: boolean;
  #zoomBindTimeout?: number;

  readonly setCaption = throttle((caption: string) => this.#setCaption(caption), CAPTION_THROTTLE_MS);

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
    }, ZOOM_OUT_BIND_DELAY);

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

  readonly #onZoomOut = () => {
    this.#titleElement = toggleText(this.#zoomOutElement!, this.#title, 'lovely-chart--header-title', true);
    this.#titleElement.classList.remove('lovely-chart--transition');

    this.#zoomOutCallback();
  };
}
