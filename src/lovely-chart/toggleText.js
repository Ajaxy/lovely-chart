import { createElement } from './minifiers';

const ANIMATION_TIME = 400;

function fadeIn(element) {
  element.classList.add('animated');
  element.classList.remove('hidden');

  setTimeout(() => {
    element.classList.remove('animated');
  }, ANIMATION_TIME);
}

function fadeOut(element) {
  element.classList.add('animated');
  element.classList.add('hidden');

  setTimeout(() => {
    element.classList.remove('animated');
  }, ANIMATION_TIME);
}

export default function toggleText(element, newText, className, inverse = false) {
  var newElement = createElement();
  newElement.className = `${className} transition ${inverse ? 'top' : 'bottom'} hidden`;
  newElement.innerHTML = newText;

  const classList = className.indexOf(' ') !== -1 ?
    className.split(' ') : [className];
  var oldElements = element.parentNode.querySelectorAll(`.${classList.join('.')}.hidden`);
  oldElements.forEach(e => e.remove());

  element.parentNode.insertBefore(newElement, element.nextSibling);
  element.classList.remove('bottom');

  fadeIn(newElement);
  fadeOut(element);

  return newElement;
}
