import { createElement, addEventListener } from './minifiers';
import animation from './animation';

export function createHeader(container, title, zoomOutCallback) {
  const _container = container;
  const _title = title;
  const _zoomOutCallback = zoomOutCallback;

  let _element;
  let _titleElement;
  let _zoomOutElement;
  let _caption1Element;
  let _caption2Element;

  let _isZoomed = false;

  _setupLayout();

  function setCaption(caption) {
    _caption1Element.innerHTML = caption;
    _caption2Element.innerHTML = caption;
  }

  function zoom(caption) {
    _isZoomed = true;

    setCaption(caption);

    animation.fadeOut(_titleElement);
    animation.fadeIn(_zoomOutElement);
    animation.fadeOut(_caption1Element);
    animation.fadeIn(_caption2Element);
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'header';

    _titleElement = createElement();
    _titleElement.className = 'title transition from-top';
    _titleElement.innerHTML = _title;
    _element.appendChild(_titleElement);

    _zoomOutElement = createElement();
    _zoomOutElement.className = 'title zoom-out hidden transition from-bottom';
    _zoomOutElement.innerHTML = 'Zoom Out';
    addEventListener(_zoomOutElement, 'click', _onZoomOut);
    _element.appendChild(_zoomOutElement);

    _caption1Element = createElement();
    _caption1Element.className = 'caption transition from-top right';
    _element.appendChild(_caption1Element);

    _caption2Element = createElement();
    _caption2Element.className = 'caption hidden transition from-bottom right';
    _element.appendChild(_caption2Element);

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
