import { createElement, addEventListener } from './minifiers';
import animation from './animation';

export function createHeader(container, title, zoomOutCallback) {
  const _container = container;
  const _title = title;
  const _zoomOutCallback = zoomOutCallback;

  let _element;
  let _titleElement;
  let _zoomOutElement;
  let _captionElement;

  let _isZoomed = false;

  _setupLayout();

  function setCaption(caption) {
    console.log('setting caption', caption);
    if (!_captionElement.innerHTML) {
      _captionElement.innerHTML = caption;
    } else {
      _captionElement = animation.toggleText(_captionElement, caption, 'caption right');
    }
  }

  function zoom(caption) {
    _isZoomed = true;

    animation.fadeOut(_titleElement);
    animation.fadeIn(_zoomOutElement);

    setCaption(caption);
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'header transition-container';

    _titleElement = createElement();
    _titleElement.className = 'title transition top';
    _titleElement.innerHTML = _title;
    _element.appendChild(_titleElement);

    _zoomOutElement = createElement();
    _zoomOutElement.className = 'title zoom-out hidden transition bottom';
    _zoomOutElement.innerHTML = 'Zoom Out';
    addEventListener(_zoomOutElement, 'click', _onZoomOut);
    _element.appendChild(_zoomOutElement);

    _captionElement = createElement();
    _captionElement.className = 'caption transition top right';
    _element.appendChild(_captionElement);

    _container.appendChild(_element);
  }

  function _onZoomOut() {
    _isZoomed = true;

    animation.fadeOut(_zoomOutElement);
    animation.fadeIn(_titleElement);
    animation.fadeOut(_caption2Element);
    animation.fadeIn(_caption1Element);

    _zoomOutCallback();
  }

  return {
    setCaption,
    zoom,
  };
}
