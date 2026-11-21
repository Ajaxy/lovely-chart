// A small syntax highlighter for the languages of the docs: JavaScript and its dialects, CSS, HTML with its scripts and
// styles, JSON and shell. It returns escaped HTML with a `tok-*` class on each token it colours.

const JS_LANGUAGES = new Set(['js', 'javascript', 'mjs', 'ts', 'typescript', 'jsx', 'tsx', 'json', 'vue', 'svelte']);
const HTML_LANGUAGES = new Set(['html', 'xml', 'svg']);
const SHELL_LANGUAGES = new Set(['bash', 'sh', 'shell', 'zsh', 'console']);

const JS_KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'delete', 'do', 'else',
  'export', 'extends', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements', 'import', 'in', 'instanceof',
  'interface', 'let', 'new', 'of', 'private', 'public', 'readonly', 'return', 'set', 'static', 'switch', 'this',
  'throw', 'try', 'type', 'typeof', 'var', 'void', 'while', 'yield',
]);
const JS_LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);

const JS_TOKEN = new RegExp([
  /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)/.source,
  /(?<string>`(?:\\[\s\S]|[^\\`])*`|'(?:\\.|[^\\'\n])*'|"(?:\\.|[^\\"\n])*")/.source,
  /(?<number>\b(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b)/.source,
  /(?<tag><\/?[A-Za-z][\w.-]*|\/?>)/.source,
  /(?<word>[A-Za-z_$][\w$]*)/.source,
].join('|'), 'g');

const CSS_TOKEN = new RegExp([
  /(?<comment>\/\*[\s\S]*?\*\/)/.source,
  /(?<string>'(?:\\.|[^\\'\n])*'|"(?:\\.|[^\\"\n])*")/.source,
  /(?<atRule>@[\w-]+)/.source,
  /(?<variable>--[\w-]+)/.source,
  /(?<color>#[\da-fA-F]{3,8}\b)/.source,
  /(?<number>-?\b\d*\.?\d+(?:%|[a-zA-Z]+)?)/.source,
  /(?<word>[A-Za-z_-][\w-]*)/.source,
  /(?<brace>[{}])/.source,
].join('|'), 'g');

const HTML_TOKEN = /(?<comment><!--[\s\S]*?-->)|(?<doctype><!doctype[^>]*>)|(?<tag><\/?[A-Za-z][\w-]*)(?<attrs>(?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(?<close>\/?>)/gi;
const HTML_ATTRIBUTE = /(?<name>[^\s=/>]+)(?:(?<equals>\s*=\s*)(?<value>"[^"]*"|'[^']*'|[^\s>]+))?/g;

const SHELL_TOKEN = /(?<comment>(?:^|\s)#[^\n]*)|(?<string>'[^']*'|"(?:\\.|[^\\"])*")|(?<flag>(?:^|\s)--?[\w-]+)|(?<command>^\s*[\w.-]+|(?<=[|&;]\s*)[\w.-]+)/gm;

export function highlight(code, language = '') {
  const lang = language.toLowerCase();
  if (JS_LANGUAGES.has(lang)) {
    return highlightJs(code);
  }
  if (lang === 'css' || lang === 'scss') {
    return highlightCss(code);
  }
  if (HTML_LANGUAGES.has(lang)) {
    return highlightHtml(code);
  }
  if (SHELL_LANGUAGES.has(lang)) {
    return highlightShell(code);
  }
  return escapeHtml(code);
}

export function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[char]);
}

function wrap(className, text) {
  return `<span class="tok-${className}">${escapeHtml(text)}</span>`;
}

function highlightJs(code) {
  let html = '';
  let last = 0;

  for (const match of code.matchAll(JS_TOKEN)) {
    const { comment, string, number, tag, word } = match.groups;
    html += escapeHtml(code.slice(last, match.index));
    last = match.index + match[0].length;

    if (comment) {
      html += wrap('comment', comment);
    } else if (string) {
      html += wrap('string', string);
    } else if (number) {
      html += wrap('number', number);
    } else if (tag) {
      html += isJsxTag(code, match.index) ? wrap('tag', tag) : escapeHtml(tag);
    } else {
      html += wrap(classifyJsWord(code, word, last), word);
    }
  }

  return html + escapeHtml(code.slice(last));
}

// A `<` opens a JSX tag where an expression starts, not between two operands
function isJsxTag(code, index) {
  if (code[index] !== '<') {
    return /^\s*$/.test(code.slice(code.lastIndexOf('\n', index) + 1, index)) || code[index - 1] === '<';
  }
  const before = code.slice(0, index).trimEnd();
  return before === '' || /[(,=>?:{[&|!;]$|\breturn$/.test(before);
}

function classifyJsWord(code, word, end) {
  if (JS_KEYWORDS.has(word)) {
    return 'keyword';
  }
  if (JS_LITERALS.has(word)) {
    return 'literal';
  }
  const rest = code.slice(end, end + 40);
  if (/^\s*\(/.test(rest)) {
    return 'function';
  }
  if (/^\s*:(?!:)/.test(rest) && /[{,\n]\s*$/.test(code.slice(Math.max(0, end - word.length - 40), end - word.length))) {
    return 'property';
  }
  if (/^[A-Z]/.test(word)) {
    return 'type';
  }
  return 'plain';
}

function highlightCss(code) {
  let html = '';
  let last = 0;
  let depth = 0;

  for (const match of code.matchAll(CSS_TOKEN)) {
    const { comment, string, atRule, variable, color, number, word, brace } = match.groups;
    html += escapeHtml(code.slice(last, match.index));
    last = match.index + match[0].length;

    if (comment) {
      html += wrap('comment', comment);
    } else if (string) {
      html += wrap('string', string);
    } else if (atRule) {
      html += wrap('keyword', atRule);
    } else if (variable) {
      html += wrap('variable', variable);
    } else if (color || number) {
      html += wrap('number', color || number);
    } else if (brace) {
      depth = Math.max(0, depth + (brace === '{' ? 1 : -1));
      html += escapeHtml(brace);
    } else if (word) {
      const rest = code.slice(last);
      if (/^\(/.test(rest)) {
        html += wrap('function', word);
      } else if (depth > 0 && /^\s*:/.test(rest) && !/^\s*:[^;{}]*\{/.test(rest)) {
        html += wrap('property', word);
      } else if (depth === 0 || /^[^;{}]*\{/.test(rest)) {
        html += wrap('selector', word);
      } else {
        html += escapeHtml(word);
      }
    }
  }

  return html + escapeHtml(code.slice(last));
}

function highlightHtml(code) {
  let html = '';
  let last = 0;
  HTML_TOKEN.lastIndex = 0;

  for (let match = HTML_TOKEN.exec(code); match; match = HTML_TOKEN.exec(code)) {
    const { comment, doctype, tag, attrs, close } = match.groups;
    html += escapeHtml(code.slice(last, match.index));
    last = match.index + match[0].length;

    if (comment || doctype) {
      html += wrap('comment', comment || doctype);
      continue;
    }

    html += wrap('tag', tag) + highlightAttributes(attrs) + wrap('tag', close);

    // The text of a script or a style is code of its own up to the closing tag
    const name = tag.toLowerCase();
    if (name === '<script' || name === '<style') {
      const closing = `</${name.slice(1)}`;
      const end = code.toLowerCase().indexOf(closing, last);
      const contentEnd = end === -1 ? code.length : end;
      const content = code.slice(last, contentEnd);
      html += name === '<script' ? highlightJs(content) : highlightCss(content);
      last = contentEnd;
      HTML_TOKEN.lastIndex = contentEnd;
    }
  }

  return html + escapeHtml(code.slice(last));
}

function highlightAttributes(attrs) {
  let html = '';
  let last = 0;

  for (const match of attrs.matchAll(HTML_ATTRIBUTE)) {
    const { name, equals, value } = match.groups;
    html += escapeHtml(attrs.slice(last, match.index));
    last = match.index + match[0].length;
    html += wrap('attribute', name);
    if (equals) {
      html += escapeHtml(equals) + wrap('string', value);
    }
  }

  return html + escapeHtml(attrs.slice(last));
}

function highlightShell(code) {
  let html = '';
  let last = 0;

  for (const match of code.matchAll(SHELL_TOKEN)) {
    const { comment, string, flag, command } = match.groups;
    html += escapeHtml(code.slice(last, match.index));
    last = match.index + match[0].length;

    if (comment) {
      html += wrap('comment', comment);
    } else if (string) {
      html += wrap('string', string);
    } else if (flag) {
      html += wrap('property', flag);
    } else {
      html += wrap('function', command);
    }
  }

  return html + escapeHtml(code.slice(last));
}
