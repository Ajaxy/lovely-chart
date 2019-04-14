import { createElement, addEventListener } from './minifiers';

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

    _titleElement.classList.add('hidden');
    _zoomOutElement.classList.remove('hidden');
  }

  function _setupLayout() {
    _element = createElement();
    _element.className = 'header';

    _titleElement = createElement();
    _titleElement.className = 'title fadeOutUp';
    _titleElement.innerHTML = _title;
    _element.appendChild(_titleElement);

    _zoomOutElement = createElement();
    _zoomOutElement.className = 'title zoom-out hidden fadeInDown';
    _zoomOutElement.innerHTML = 'Zoom Out';
    addEventListener(_zoomOutElement, 'click', _onZoomOut);
    _element.appendChild(_zoomOutElement);

    _caption1Element = createElement();
    _caption1Element.className = 'caption fadeOutUp';
    _element.appendChild(_caption1Element);

    _caption2Element = createElement();
    _caption2Element.className = 'caption hidden fadeInDown';
    _element.appendChild(_caption2Element);

    _container.appendChild(_element);
  }

  function _onZoomOut() {
    _isZoomed = true;

    _titleElement.classList.remove('hidden');
    _zoomOutElement.classList.add('hidden');

    _zoomOutCallback();
  }

  return {
    setCaption,
    zoom,
  };
}
