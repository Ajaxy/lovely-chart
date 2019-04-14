import { createElement } from './minifiers';

const ANIMATION_TIME = 400;

function fadeIn(element) {
  // Remove and add `animated` class to re-trigger animation
  element.classList.remove('animated');
  element.classList.add('animated');
  element.classList.remove('hidden');
}

function fadeOut(element) {
  // Remove and add `animated` class to re-trigger animation
  element.classList.remove('animated');
  element.classList.add('animated');
  element.classList.add('hidden');
}

export default function toggleText(element, newText, className, inverse = false) {
  const container = element.parentNode;
  container.classList.add('transition-container');

  const newElement = createElement();
  newElement.className = `${className} transition ${inverse ? 'top' : 'bottom'} hidden`;
  newElement.innerHTML = newText;

  const oldElements = container.querySelectorAll(`.${className.split(' ').join('.')}.hidden`);
  oldElements.forEach(e => e.remove());

  element.classList.add('transition');
  element.classList.remove('bottom', 'top');
  element.classList.add(inverse ? 'bottom' : 'top');
  container.insertBefore(newElement, element.nextSibling);

  fadeIn(newElement);
  fadeOut(element);

  return newElement;
}
