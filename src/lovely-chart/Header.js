import { createElement, addEventListener } from './minifiers';
import toggleText from './toggleText';
import { throttle } from './fast';

export function createHeader(container, title, zoomOutCallback) {
  const _container = container;
  const _title = title;
  const _zoomOutCallback = zoomOutCallback;

  let _element;
  let _titleElement;
  let _zoomOutElement;
  let _captionElement;

  let _isZoomed = false;

  const setCaptionThrottled = throttle(setCaption, 800, true, true);

  _setupLayout();

  function setCaption(caption) {
    if (!_captionElement.innerHTML) {
      _captionElement.innerHTML = caption;
    } else if (_captionElement.innerHTML !== caption) {
      _captionElement = toggleText(_captionElement, caption, 'caption right');
    }
  }

  function zoom(caption) {
    _isZoomed = true;

    _zoomOutElement = toggleText(_titleElement, 'Zoom Out', 'title zoom-out');
    addEventListener(_zoomOutElement, 'click', _onZoomOut);

    setCaption(caption);
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'header';

    _titleElement = createElement();
    _titleElement.className = 'title';
    _titleElement.innerHTML = _title;
    _element.appendChild(_titleElement);

    _captionElement = createElement();
    _captionElement.className = 'caption right';
    _element.appendChild(_captionElement);

    _container.appendChild(_element);
  }

  function _onZoomOut() {
    _isZoomed = true;

    _titleElement = toggleText(_zoomOutElement, _title, 'title', true);

    _zoomOutCallback();
  }

  return {
    setCaption: setCaptionThrottled,
    zoom,
  };
}
