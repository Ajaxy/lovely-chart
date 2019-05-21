import { createElement, addEventListener } from './minifiers';
import { toggleText } from './toggleText';
import { throttle } from './utils';

export function createHeader(container, title, zoomOutCallback) {
  let _element;
  let _titleElement;
  let _zoomOutElement;
  let _captionElement;

  let _isZoomed = false;
  let _isFirstUpdate = true;

  const setCaptionThrottled = throttle(setCaption, 400, false, true);

  _setupLayout();

  function setCaption(caption) {
    if (!_captionElement.innerHTML) {
      _captionElement.innerHTML = caption;
      _isFirstUpdate = false;
    } else if (_captionElement.innerHTML !== caption) {
      _captionElement = toggleText(_captionElement, caption, 'lovely-chart--header-caption lovely-chart--position-right');
    }
  }

  function zoom(caption) {
    _isZoomed = true;

    _zoomOutElement = toggleText(_titleElement, 'Zoom Out', 'lovely-chart--header-title lovely-chart--header-zoom-out-control');
    addEventListener(_zoomOutElement, 'click', _onZoomOut);

    setCaption(caption);
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'lovely-chart--header';

    _titleElement = createElement();
    _titleElement.className = 'lovely-chart--header-title';
    _titleElement.innerHTML = title;
    _element.appendChild(_titleElement);

    _captionElement = createElement();
    _captionElement.className = 'lovely-chart--header-caption lovely-chart--position-right';
    _element.appendChild(_captionElement);

    container.appendChild(_element);
  }

  function _onZoomOut() {
    _isZoomed = true;

    _titleElement = toggleText(_zoomOutElement, title, 'lovely-chart--header-title', true);

    zoomOutCallback();
  }

  return {
    setCaption: setCaptionThrottled,
    zoom,
  };
}
