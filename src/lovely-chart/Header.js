import { createElement, addEventListener } from './minifiers';
import { toggleText } from './toggleText';
import { throttle } from './fast';

export function createHeader(container, title, zoomOutCallback) {
  let _element;
  let _titleElement;
  let _zoomOutElement;
  let _captionElement;

  let _isZoomed = false;
  let _isFirstUpdate = true;

  const _updateCaptionThrottled = throttle(_updateCaption, 800, false, true);

  _setupLayout();

  function setCaption(caption) {
    if (_isFirstUpdate) {
      // This prevents initial render delay made by throttling
      _captionElement.innerHTML = caption;
      _isFirstUpdate = false;
    } else {
      _updateCaptionThrottled(caption);
    }
  }

  function zoom(caption) {
    _isZoomed = true;

    _zoomOutElement = toggleText(_titleElement, 'Zoom Out', 'title zoom-out');
    addEventListener(_zoomOutElement, 'click', _onZoomOut);

    setCaption(caption);
  }

  function _updateCaption(caption) {
    if (_captionElement.innerHTML != caption) {
      _captionElement = toggleText(_captionElement, caption, 'caption right');
    }
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'header';

    _titleElement = createElement();
    _titleElement.className = 'title';
    _titleElement.innerHTML = title;
    _element.appendChild(_titleElement);

    _captionElement = createElement();
    _captionElement.className = 'caption right';
    _element.appendChild(_captionElement);

    container.appendChild(_element);
  }

  function _onZoomOut() {
    _isZoomed = true;

    _titleElement = toggleText(_zoomOutElement, title, 'title', true);

    zoomOutCallback();
  }

  return {
    setCaption,
    zoom,
  };
}
