// The markup of a page of the guide, built from its Markdown with no DOM: by the browser as the reader moves between
// pages, and by `scripts/site.js` into the static page of each, which the browser then takes over

import { getEntryAnchor, isEntryTable, readEntryNames } from './api.js';
import { escapeHtml } from './highlight.js';
import { renderCodeBlock, renderMarkdown, stripInline } from './markdown.js';
import {
  getGuideUrl, getPageMarkdownUrl, getPageSourceUrl, PAGES, PUBLIC_URL, REPOSITORY_URL, resolveGuideLink, SECTIONS,
  SITE_ROOT,
} from './pages.js';

const LIVE_LANGUAGES = new Set(['js', 'html']);
// The longest description of a page in its `<meta>`, past which it ends at a word
const DESCRIPTION_LENGTH = 200;

export const ICONS = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.2 3.8a2.7 2.7 0 0 1 3.8 3.8L8.4 18.2l-4.9 1.3 1.3-4.9L15.2 3.8Zm2.4 1.4a.7.7 0 0 0-1 0L6.6 15.6l-.5 1.9 1.9-.5 10-10a.7.7 0 0 0 0-1Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h10a3 3 0 0 1 3 3v10a1 1 0 1 1-2 0V6a1 1 0 0 0-1-1H8a1 1 0 0 1 0-2Zm-2 4h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6Z"/></svg>',
  open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V6.41l-8.3 8.3a1 1 0 0 1-1.4-1.42L17.58 5H14a1 1 0 1 1 0-2ZM5 7a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5a1 1 0 1 1 2 0v5a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h5a1 1 0 1 1 0 2H5Z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.3 9.3a1 1 0 0 1 1.4 0L12 13.6l4.3-4.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 0-1.4Z"/></svg>',
};

/**
 * The article of a page, with its live examples as their code until the browser mounts them, the headings of its table
 * of contents and the sources of its live examples in their order
 */
export function renderGuideArticle(page, markdown) {
  const liveSources = [];
  const { html, headings } = renderMarkdown(markdown, {
    resolveLink: resolveGuideLink,
    renderCode(lang, flags, code) {
      if (!flags.includes('live') || !LIVE_LANGUAGES.has(lang)) {
        return undefined;
      }
      liveSources.push(lang === 'html' ? { html: code } : { js: code });
      return `<figure class="live" data-live="${liveSources.length - 1}">${renderCodeBlock(lang, code)}</figure>`;
    },
    renderTable(header, rows, alignments, renderInline) {
      return isEntryTable(header) ? renderEntries(header, rows, renderInline) : undefined;
    },
  });

  const section = SECTIONS.find(({ pages }) => pages.includes(page));
  const head = `<div class="guide-page-head"><p class="guide-breadcrumb">${escapeHtml(section.title)}</p>`
    + `${renderPageActions(page)}</div>`;
  return { html: head + html, headings, liveSources };
}

// The ways to take the page elsewhere: its Markdown, copied or as a file, and an assistant that reads it
function renderPageActions(page) {
  const markdownUrl = getPageMarkdownUrl(page.slug);
  const prompt = `Read ${getPageMarkdownUrl(page.slug, PUBLIC_URL)}, the "${page.title}" page of the docs of the `
    + 'LovelyChart charting library, so I can ask you about it.';
  const query = encodeURIComponent(prompt);
  return `<div class="page-actions">
    <button class="button" type="button" data-copy-page>${ICONS.copy}<span>Copy page</span></button>
    <details class="page-menu">
      <summary class="button" aria-label="More ways to read this page">${ICONS.chevron}</summary>
      <div class="page-menu-list">
        <a href="${markdownUrl}" type="text/markdown"><strong>View as Markdown</strong><span>This page as plain text</span></a>
        <a href="https://claude.ai/new?q=${query}" target="_blank" rel="noopener"><strong>Open in Claude</strong><span>Ask about this page</span></a>
        <a href="https://chatgpt.com/?q=${query}" target="_blank" rel="noopener"><strong>Open in ChatGPT</strong><span>Ask about this page</span></a>
        <a href="${new URL('llms-full.txt', SITE_ROOT).href}"><strong>llms-full.txt</strong><span>Every page in one file, for a language model</span></a>
      </div>
    </details>
  </div>`;
}

/**
 * The rows of a table of the reference as entries, each with the anchor of its name and of the other names it lists
 */
function renderEntries(header, rows, renderInline) {
  const typeIndex = header.findIndex((cell) => stripInline(cell) === 'Type');
  const entries = rows.map((row) => {
    const names = readEntryNames(row[0]);
    const anchor = getEntryAnchor(names[0] || stripInline(row[0]));
    const aliases = [...new Set(names.slice(1).map(getEntryAnchor))]
      .filter((alias) => alias !== anchor)
      .map((alias) => `<span class="api-alias" id="${escapeHtml(alias)}"></span>`)
      .join('');
    const type = typeIndex > 0 ? row[typeIndex] : '';
    const description = row[row.length - 1] || '';
    const searchText = `${names.join(' ')} ${stripInline(description)}`.toLowerCase();

    return `<div class="api-entry" id="${escapeHtml(anchor)}" data-search="${escapeHtml(searchText)}">${aliases}
      <div class="api-entry-head">
        <a class="api-entry-name" href="#${escapeHtml(anchor)}">${renderInline(row[0])}</a>
        ${type ? `<span class="api-entry-type">${renderInline(type)}</span>` : ''}
      </div>
      <div class="api-entry-body">${renderInline(description)}</div>
    </div>`;
  });
  return `<div class="api-list">${entries.join('')}</div>`;
}

export function renderSidebar(activeSlug) {
  return SECTIONS.map(({ title, pages }) => `
    <div class="sidebar-section">
      <p class="sidebar-title">${escapeHtml(title)}</p>
      <ul>${pages.map(({ slug, title: pageTitle }) => `
        <li><a href="${getGuideUrl(slug)}" data-slug="${slug}"${slug === activeSlug ? ' aria-current="page"' : ''}>${escapeHtml(pageTitle)}</a></li>`).join('')}
      </ul>
    </div>`).join('');
}

export function renderToc(headings) {
  const items = headings.filter(({ level }) => level === 2 || level === 3);
  if (items.length < 2) {
    return '';
  }
  return `<p class="toc-title">On this page</p><ul>${items.map(({ level, text, id }) => `
    <li class="toc-level-${level}"><a href="#${escapeHtml(id)}">${escapeHtml(text)}</a></li>`).join('')}</ul>`;
}

export function renderFooter(page) {
  const index = PAGES.indexOf(page);
  const previous = PAGES[index - 1];
  const next = PAGES[index + 1];
  return `
    <nav class="pager" aria-label="Pages">
      ${previous ? `<a class="pager-previous" href="${getGuideUrl(previous.slug)}"><span>Previous</span>${escapeHtml(previous.title)}</a>` : ''}
      ${next ? `<a class="pager-next" href="${getGuideUrl(next.slug)}"><span>Next</span>${escapeHtml(next.title)}</a>` : ''}
    </nav>
    <div class="guide-meta">
      <a href="${getPageSourceUrl(page.slug)}" target="_blank" rel="noopener">Edit this page on GitHub</a>
      <a href="${REPOSITORY_URL}/issues" target="_blank" rel="noopener">Report an issue</a>
    </div>`;
}

export function getPageTitle(page) {
  return `${page.title} · LovelyChart`;
}

/**
 * What a page is about, for its `<meta>` and the index of `llms.txt`: the sentences that open its first paragraph of
 * prose, as plain text, or with its code spans as Markdown with `isMarkdown`
 */
export function getPageDescription(page, markdown, { isMarkdown = false } = {}) {
  if (page.slug === 'changelog') {
    return 'The changes of each release of LovelyChart: what each adds, changes and fixes.';
  }
  const lead = markdown.replace(/```[\s\S]*?```/g, '').split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block && !/^(#|<|-|\*|\||>|\d+\.)/.test(block)) || '';
  const text = (isMarkdown ? lead.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') : stripInline(lead))
    .replace(/\s+/g, ' ')
    .trim();

  let description = '';
  for (const sentence of text.split(/(?<=[.!?:])\s+(?=[A-Z`])/)) {
    if (description && description.length + sentence.length >= DESCRIPTION_LENGTH) {
      break;
    }
    description = description ? `${description} ${sentence}` : sentence;
  }
  if (description.length <= DESCRIPTION_LENGTH) {
    return description;
  }
  return `${description.slice(0, description.lastIndexOf(' ', DESCRIPTION_LENGTH - 1))}…`;
}
