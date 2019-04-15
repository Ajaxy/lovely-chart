import { createElement } from './minifiers';

function toggleIn(element) {
  // Remove and add `animated` class to re-trigger animation
  element.classList.remove('animated');
  element.classList.add('animated');
  element.classList.remove('hidden');
}

function toggleOut(element) {
  // Remove and add `animated` class to re-trigger animation
  element.classList.remove('animated');
  element.classList.add('animated');
  element.classList.add('hidden');
}

export function toggleText(element, newText, className = '', inverse = false) {
  const container = element.parentNode;
  container.classList.add('transition-container');

  const newElement = createElement(element.tagName);
  newElement.className = `${className} transition ${inverse ? 'top' : 'bottom'} hidden`;
  newElement.innerHTML = newText;

  const selector = className.length ? `.${className.split(' ').join('.')}` : '';
  const oldElements = container.querySelectorAll(`${selector}.hidden`);
  oldElements.forEach(e => e.remove());

  element.classList.add('transition');
  element.classList.remove('bottom', 'top');
  element.classList.add(inverse ? 'bottom' : 'top');
  container.insertBefore(newElement, element.nextSibling);

  toggleIn(newElement);
  toggleOut(element);

  return newElement;
}
