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

function toggleText(element, newText, className) {
  var newElement = createElement();
  newElement.className = `${className} transition bottom hidden`;
  newElement.innerHTML = newText;

  const classList = className.indexOf(' ') !== -1 ?
    className.split(' ') : [className];
  var oldElements = element.parentNode.querySelectorAll(`.${classList.join('.')}.hidden`);
  oldElements.forEach(e => e.remove());

  element.parentNode.insertBefore(newElement, element.nextSibling);
  element.classList.remove('bottom');
  element.classList.add('top');

  fadeIn(newElement);
  fadeOut(element);

  return newElement;
}

export default {
  fadeIn,
  fadeOut,
  toggleText
}
