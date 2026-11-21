// A code editor of a textarea over its highlighted copy, both in one scrolling box: the textarea takes the typing,
// selection and undo of the browser, and the copy under it the colours

import { highlight } from './highlight.js';

const INDENT = '  ';
const OPENERS = /[{[(]\s*$/;
const CLOSER = /^\s*[}\])]/;

/**
 * Creates an editor in `parent`. `onChange(value)` follows each edit, and `onRun()` Ctrl or Cmd with Enter or S.
 * Escape lets the next Tab leave the editor, which otherwise indents.
 */
export function createEditor(parent, { value = '', language = 'js', label = 'Code', onChange, onRun } = {}) {
  const root = document.createElement('div');
  root.className = 'editor';
  root.innerHTML = `
    <div class="editor-gutter" aria-hidden="true"></div>
    <div class="editor-body">
      <pre class="editor-highlight" aria-hidden="true"><code></code></pre>
      <textarea class="editor-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"
        wrap="off"></textarea>
    </div>`;
  parent.appendChild(root);

  const gutter = root.querySelector('.editor-gutter');
  const code = root.querySelector('code');
  const input = root.querySelector('textarea');
  input.setAttribute('aria-label', label);
  let currentLanguage = language;
  let lineCount = 0;
  let canTabLeave = false;

  input.value = value;
  render();

  input.addEventListener('input', () => {
    render();
    onChange?.(input.value);
  });

  input.addEventListener('keydown', (e) => {
    const isModified = e.metaKey || e.ctrlKey;
    if (isModified && (e.key === 'Enter' || e.key === 's')) {
      e.preventDefault();
      onRun?.();
      return;
    }
    if (e.key === 'Escape') {
      canTabLeave = true;
      return;
    }
    if (e.key === 'Tab' && !isModified && !e.altKey) {
      if (canTabLeave) {
        canTabLeave = false;
        return;
      }
      e.preventDefault();
      if (e.shiftKey) {
        outdent();
      } else {
        indent();
      }
      return;
    }
    canTabLeave = false;
    if (e.key === 'Enter' && !e.shiftKey && !isModified && !e.altKey) {
      e.preventDefault();
      insertLineBreak();
    }
  });

  input.addEventListener('blur', () => {
    canTabLeave = false;
  });

  function render() {
    // The trailing line break keeps the height of a last empty line
    code.innerHTML = `${highlight(input.value, currentLanguage)}\n`;
    const count = input.value.split('\n').length;
    if (count !== lineCount) {
      lineCount = count;
      gutter.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    }
  }

  function insertText(text) {
    // `insertText` keeps the edit in the undo history of the textarea
    if (!document.execCommand('insertText', false, text)) {
      input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
      input.dispatchEvent(new Event('input'));
    }
  }

  function insertLineBreak() {
    const { selectionStart, value: text } = input;
    const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
    const line = text.slice(lineStart, selectionStart);
    const indentation = line.match(/^\s*/)[0];
    const after = text.slice(input.selectionEnd, text.indexOf('\n', input.selectionEnd) === -1
      ? text.length
      : text.indexOf('\n', input.selectionEnd));

    if (OPENERS.test(line) && CLOSER.test(after)) {
      insertText(`\n${indentation}${INDENT}\n${indentation}`);
      const caret = input.selectionStart - indentation.length - 1;
      input.setSelectionRange(caret, caret);
      return;
    }
    insertText(`\n${indentation}${OPENERS.test(line) ? INDENT : ''}`);
  }

  function selectLines() {
    const { selectionStart, selectionEnd, value: text } = input;
    const start = text.lastIndexOf('\n', selectionStart - 1) + 1;
    const lastBreak = text.indexOf('\n', selectionEnd - (selectionEnd > selectionStart ? 1 : 0));
    const end = lastBreak === -1 ? text.length : lastBreak;
    return { start, end, lines: text.slice(start, end).split('\n') };
  }

  function indent() {
    if (input.selectionStart === input.selectionEnd) {
      insertText(INDENT);
      return;
    }
    const { start, end, lines } = selectLines();
    input.setSelectionRange(start, end);
    insertText(lines.map((line) => INDENT + line).join('\n'));
    input.setSelectionRange(start, start + lines.join('\n').length + lines.length * INDENT.length);
  }

  function outdent() {
    const { start, end, lines } = selectLines();
    const outdented = lines.map((line) => line.replace(new RegExp(`^ {1,${INDENT.length}}`), ''));
    if (outdented.join('\n') === lines.join('\n')) {
      return;
    }
    input.setSelectionRange(start, end);
    insertText(outdented.join('\n'));
    input.setSelectionRange(start, start + outdented.join('\n').length);
  }

  return {
    element: root,
    getValue: () => input.value,
    setValue(text, nextLanguage = currentLanguage) {
      currentLanguage = nextLanguage;
      input.value = text;
      render();
    },
    focus: () => input.focus(),
  };
}
