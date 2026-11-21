// A Markdown renderer for the docs: the GitHub-flavoured subset the pages use, with headings that take GitHub's
// anchors, tables, alerts and fenced code. Hooks let a page render code blocks and tables of its own.

import { escapeHtml, highlight } from './highlight.js';

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)\s*(.*)$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])(\s+|$)(.*)$/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const HTML_BLOCK = /^ {0,3}<(\/?)(div|p|img|a|table|details|summary|section|figure|picture|br|hr|kbd|span)\b/i;
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;
const INLINE_TAG = /^<\/?[a-z][a-z0-9-]*(\s[^<>]*)?\/?>/i;
const AUTOLINK = /^https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/;

/**
 * Renders `markdown` to HTML. `options` may hold `resolveLink(href)`, giving the href a link takes, `renderCode(lang,
 * flags, code)` and `renderTable(header, rows, alignments)`, each returning HTML of its own or `undefined` for the
 * default. Returns the HTML and the headings, `{ level, text, id }`.
 */
export function renderMarkdown(markdown, options = {}) {
  const context = {
    options,
    headings: [],
    usedIds: new Map(),
  };
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html = renderBlocks(lines, context);
  return { html, headings: context.headings };
}

/**
 * The anchor GitHub gives a heading: lowercase, its punctuation dropped and its spaces turned into hyphens
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

/**
 * The text of inline Markdown without its marks, as for a title or a search entry
 */
export function stripInline(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\\(.)/g, '$1')
    .trim();
}

function renderBlocks(lines, context) {
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      const [, marker, lang, flags] = fence;
      const indent = line.match(/^ */)[0].length;
      const body = [];
      i++;
      while (i < lines.length && !new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`).test(lines[i])) {
        body.push(lines[i].slice(Math.min(indent, lines[i].match(/^ */)[0].length)));
        i++;
      }
      i++;
      html += renderCode(lang, flags.split(/\s+/).filter(Boolean), body.join('\n'), context);
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      html += renderHeading(heading[1].length, heading[2], context);
      i++;
      continue;
    }

    if (HR.test(line)) {
      html += '<hr>';
      i++;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quote = [];
      while (i < lines.length && lines[i].trim() && /^ {0,3}>/.test(lines[i])) {
        quote.push(lines[i].replace(/^ {0,3}> ?/, ''));
        i++;
      }
      html += renderQuote(quote, context);
      continue;
    }

    if (isTableStart(lines, i)) {
      const rows = [];
      const header = splitRow(line);
      const alignments = splitRow(lines[i + 1]).map(readAlignment);
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      html += renderTable(header, rows, alignments, context);
      continue;
    }

    if (LIST_ITEM.test(line) && !HR.test(line)) {
      const block = [];
      while (i < lines.length && (lines[i].trim() ? isListContinuation(lines, i, block) : isListGap(lines, i))) {
        block.push(lines[i]);
        i++;
      }
      html += renderList(block, context);
      continue;
    }

    if (HTML_BLOCK.test(line)) {
      const block = [];
      while (i < lines.length && lines[i].trim()) {
        block.push(lines[i]);
        i++;
      }
      html += `${block.join('\n')}\n`;
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) {
      paragraph.push(lines[i]);
      i++;
    }
    html += `<p>${renderInline(paragraph.join('\n').trim(), context)}</p>`;
  }

  return html;
}

function startsBlock(lines, i) {
  const line = lines[i];
  return FENCE.test(line)
    || HEADING.test(line)
    || HR.test(line)
    || /^ {0,3}>/.test(line)
    || isTableStart(lines, i)
    || /^ {0,3}([-*+]|1[.)])\s+\S/.test(line)
    || HTML_BLOCK.test(line);
}

function isTableStart(lines, i) {
  return lines[i].includes('|') && i + 1 < lines.length && TABLE_DELIMITER.test(lines[i + 1])
    && lines[i + 1].includes('-');
}

function isListContinuation(lines, i, block) {
  const line = lines[i];
  if (LIST_ITEM.test(line) || /^\s+\S/.test(line)) {
    return true;
  }
  // A lazy continuation of the last item's paragraph
  const previous = block[block.length - 1];
  return previous !== undefined && previous.trim() !== '' && !startsBlock(lines, i);
}

// A blank line goes on with the list when the next text is indented under an item or starts another item
function isListGap(lines, i) {
  const next = lines.slice(i + 1).find((line) => line.trim());
  return next !== undefined && (/^\s+\S/.test(next) || LIST_ITEM.test(next));
}

function renderList(block, context) {
  const first = block[0].match(LIST_ITEM);
  const baseIndent = first[1].length;
  const isOrdered = /\d/.test(first[2]);
  const items = [];
  let isLoose = false;

  block.forEach((line) => {
    const item = line.match(LIST_ITEM);
    if (item && item[1].length <= baseIndent + 1 && /\d/.test(item[2]) === isOrdered) {
      items.push({ lines: [item[4]], contentIndent: item[1].length + item[2].length + item[3].length });
      return;
    }
    const current = items[items.length - 1];
    const indent = line.match(/^ */)[0].length;
    current.lines.push(line.slice(Math.min(indent, current.contentIndent)));
  });

  items.forEach((item) => {
    const inner = item.lines.join('\n').trimEnd();
    if (/\n\s*\n/.test(inner)) {
      isLoose = true;
    }
  });

  const start = isOrdered && parseInt(first[2], 10) !== 1 ? ` start="${parseInt(first[2], 10)}"` : '';
  const tag = isOrdered ? 'ol' : 'ul';
  const body = items.map(({ lines }) => {
    const inner = renderBlocks(lines, context);
    return `<li>${isLoose ? inner : inner.replace(/^<p>([\s\S]*?)<\/p>/, '$1').replace(/<p>([\s\S]*?)<\/p>/g, '$1')}</li>`;
  }).join('');

  return `<${tag}${start}>${body}</${tag}>`;
}

function renderQuote(lines, context) {
  const alert = lines[0].trim().match(ALERT);
  if (!alert) {
    return `<blockquote>${renderBlocks(lines, context)}</blockquote>`;
  }

  const kind = alert[1].toLowerCase();
  const title = kind[0].toUpperCase() + kind.slice(1);
  return `<div class="callout callout-${kind}" role="note"><p class="callout-title">${title}</p>`
    + `${renderBlocks(lines.slice(1), context)}</div>`;
}

function renderHeading(level, source, context) {
  const text = stripInline(source);
  let id = slugify(text);
  const count = context.usedIds.get(id) || 0;
  context.usedIds.set(id, count + 1);
  if (count) {
    id = `${id}-${count}`;
  }
  context.headings.push({ level, text, id });

  const inner = renderInline(source, context);
  if (level === 1) {
    return `<h1 id="${id}">${inner}</h1>`;
  }
  return `<h${level} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`;
}

function renderCode(lang, flags, code, context) {
  const custom = context.options.renderCode?.(lang, flags, code);
  if (custom !== undefined) {
    return custom;
  }
  return renderCodeBlock(lang, code);
}

/**
 * A highlighted code block with its language and a copy button
 */
export function renderCodeBlock(lang, code) {
  const label = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '';
  return `<div class="code-block">${label}<button class="code-copy" type="button" aria-label="Copy code">`
    + '<span>Copy</span></button>'
    + `<pre><code class="language-${escapeHtml(lang)}">${highlight(code, lang)}</code></pre></div>`;
}

function splitRow(line) {
  const cells = [];
  let cell = '';
  let isInCode = false;
  const trimmed = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === '\\' && trimmed[i + 1] === '|') {
      cell += '|';
      i++;
    } else if (char === '`') {
      isInCode = !isInCode;
      cell += char;
    } else if (char === '|' && !isInCode) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function readAlignment(cell) {
  const isLeft = cell.startsWith(':');
  const isRight = cell.endsWith(':');
  if (isLeft && isRight) {
    return 'center';
  }
  return isRight ? 'right' : undefined;
}

function renderTable(header, rows, alignments, context) {
  const custom = context.options.renderTable?.(header, rows, alignments, (text) => renderInline(text, context));
  if (custom !== undefined) {
    return custom;
  }

  const cell = (tag, text, i) => {
    const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : '';
    return `<${tag}${align}>${renderInline(text, context)}</${tag}>`;
  };
  const head = `<tr>${header.map((text, i) => cell('th', text, i)).join('')}</tr>`;
  const body = rows.map((row) => `<tr>${header.map((_, i) => cell('td', row[i] || '', i)).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/**
 * Renders inline Markdown: code spans, links, images, emphasis, strikethrough, autolinks and inline HTML tags
 */
export function renderInline(text, context = { options: {} }) {
  let html = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const rest = text.slice(i);

    if (char === '\\' && i + 1 < text.length && /[\\`*_{}[\]()#+\-.!|<>~]/.test(text[i + 1])) {
      html += escapeHtml(text[i + 1]);
      i += 2;
      continue;
    }

    if (char === '\\' && text[i + 1] === '\n') {
      html += '<br>';
      i += 2;
      continue;
    }

    if (char === '`') {
      const ticks = rest.match(/^`+/)[0];
      const end = text.indexOf(ticks, i + ticks.length);
      if (end !== -1) {
        let code = text.slice(i + ticks.length, end);
        if (/^ .* $/.test(code) && code.trim()) {
          code = code.slice(1, -1);
        }
        html += `<code>${escapeHtml(code.replace(/\n/g, ' '))}</code>`;
        i = end + ticks.length;
        continue;
      }
    }

    if (char === '!' || char === '[') {
      const link = matchLink(text, char === '!' ? i + 1 : i);
      if (link) {
        const href = escapeHtml(resolveHref(link.href, context));
        if (char === '!') {
          html += `<img src="${href}" alt="${escapeHtml(stripInline(link.label))}" loading="lazy">`;
        } else {
          const isExternal = /^https?:/.test(link.href);
          const attributes = isExternal ? ' target="_blank" rel="noopener"' : '';
          html += `<a href="${href}"${attributes}>${renderInline(link.label, context)}</a>`;
        }
        i = link.end;
        continue;
      }
    }

    if (char === '<') {
      const auto = rest.match(/^<(https?:\/\/[^>\s]+)>/);
      if (auto) {
        html += `<a href="${escapeHtml(auto[1])}" target="_blank" rel="noopener">${escapeHtml(auto[1])}</a>`;
        i += auto[0].length;
        continue;
      }
      const tag = rest.match(INLINE_TAG);
      if (tag) {
        html += tag[0];
        i += tag[0].length;
        continue;
      }
    }

    if (char === 'h' && (i === 0 || /[\s(]/.test(text[i - 1]))) {
      const url = rest.match(AUTOLINK);
      if (url) {
        html += `<a href="${escapeHtml(url[0])}" target="_blank" rel="noopener">${escapeHtml(url[0])}</a>`;
        i += url[0].length;
        continue;
      }
    }

    if (char === '*' || char === '_' || char === '~') {
      const emphasis = matchEmphasis(text, i);
      if (emphasis) {
        html += `<${emphasis.tag}>${renderInline(emphasis.inner, context)}</${emphasis.tag}>`;
        i = emphasis.end;
        continue;
      }
    }

    if (char === ' ' && /^ {2,}\n/.test(rest)) {
      html += '<br>';
      i += rest.match(/^ +\n/)[0].length;
      continue;
    }

    html += escapeHtml(char);
    i++;
  }

  return html;
}

function matchLink(text, start) {
  if (text[start] !== '[') {
    return undefined;
  }

  let depth = 0;
  let labelEnd = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
    } else if (text[i] === '`') {
      const close = text.indexOf('`', i + 1);
      i = close === -1 ? i : close;
    } else if (text[i] === '[') {
      depth++;
    } else if (text[i] === ']') {
      depth--;
      if (depth === 0) {
        labelEnd = i;
        break;
      }
    }
  }
  if (labelEnd === -1 || text[labelEnd + 1] !== '(') {
    return undefined;
  }

  const close = findClosingParen(text, labelEnd + 1);
  if (close === -1) {
    return undefined;
  }
  const target = text.slice(labelEnd + 2, close).trim();
  const href = target.replace(/\s+"[^"]*"$/, '');
  return { label: text.slice(start + 1, labelEnd), href, end: close + 1 };
}

function findClosingParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') {
      depth++;
    } else if (text[i] === ')') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function matchEmphasis(text, i) {
  const markers = [['~~', 's'], ['**', 'strong'], ['__', 'strong'], ['*', 'em'], ['_', 'em']];
  for (const [marker, tag] of markers) {
    if (!text.startsWith(marker, i)) {
      continue;
    }
    const isUnderscore = marker[0] === '_';
    // An underscore inside a word, as in `snake_case`, stays a character
    if (isUnderscore && i > 0 && /[\p{L}\p{N}]/u.test(text[i - 1])) {
      return undefined;
    }
    if (/\s/.test(text[i + marker.length] || ' ')) {
      continue;
    }
    let search = i + marker.length;
    while (search < text.length) {
      const end = text.indexOf(marker, search);
      if (end === -1) {
        break;
      }
      const isCode = text.slice(i, end).split('`').length % 2 === 0;
      const isFlanking = !/\s/.test(text[end - 1]) && end > i + marker.length;
      const isWordEnd = !isUnderscore || !/[\p{L}\p{N}]/u.test(text[end + marker.length] || ' ');
      const isDoubled = marker.length === 1 && text[end + 1] === marker && text[end - 1] !== marker;
      if (!isCode && isFlanking && isWordEnd && !isDoubled) {
        return { tag, inner: text.slice(i + marker.length, end), end: end + marker.length };
      }
      search = end + marker.length;
    }
  }
  return undefined;
}

function resolveHref(href, context) {
  return context.options.resolveLink?.(href) ?? href;
}
