// The parts every page of the site shares: the day and night skin, the copy buttons of code blocks and the search

import { readEntries } from './api.js';
import { syncFramesTheme } from './frame.js';
import { escapeHtml } from './highlight.js';
import { slugify, stripInline } from './markdown.js';
import {
  fetchPageMarkdown, getExampleUrl, getGuideUrl, PAGES,
} from './pages.js';

const THEME_STORAGE_KEY = 'lovely-chart-docs-theme';
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';
const COPIED_DURATION = 1600;
const MAX_RESULTS = 40;
const KIND_LABELS = {
  page: 'Guide', section: 'Section', entry: 'Reference', example: 'Example',
};

let searchIndex;
let searchElement;

export function initSite() {
  initTheme();
  initCopyButtons();
  initSearch();
}

function initTheme() {
  const toggles = document.querySelectorAll('[data-theme-toggle]');
  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const isDark = !document.documentElement.classList.contains('theme-dark');
      try {
        localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
      } catch {
        // The skin holds for this page alone where the browser keeps no storage
      }
      setTheme(isDark);
    });
  });
  updateThemeToggles();

  window.matchMedia(DARK_SCHEME_QUERY).addEventListener('change', (e) => {
    let stored;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      stored = undefined;
    }
    if (!stored) {
      setTheme(e.matches);
    }
  });
}

function setTheme(isDark) {
  document.documentElement.classList.toggle('theme-dark', isDark);
  updateThemeToggles();
  syncFramesTheme();
}

function updateThemeToggles() {
  const isDark = document.documentElement.classList.contains('theme-dark');
  document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
    toggle.setAttribute('aria-label', isDark ? 'Switch to the day theme' : 'Switch to the night theme');
    toggle.title = isDark ? 'Day theme' : 'Night theme';
  });
}

function initCopyButtons() {
  document.addEventListener('click', async (e) => {
    const button = e.target.closest('.code-copy');
    if (!button) {
      return;
    }
    const code = button.closest('.code-block').querySelector('code').textContent;
    await copyText(code);
    showCopied(button);
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

export function showCopied(button, text = 'Copied') {
  const label = button.querySelector('span') || button;
  const original = label.dataset.label || label.textContent;
  label.dataset.label = original;
  label.textContent = text;
  button.classList.add('is-done');
  clearTimeout(Number(button.dataset.timeout));
  button.dataset.timeout = String(setTimeout(() => {
    label.textContent = original;
    button.classList.remove('is-done');
  }, COPIED_DURATION));
}

function initSearch() {
  document.querySelectorAll('[data-search-open]').forEach((button) => {
    button.addEventListener('click', openSearch);
  });

  document.addEventListener('keydown', (e) => {
    const isEditable = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isEditable)) {
      e.preventDefault();
      openSearch();
    }
  });
}

async function openSearch() {
  if (!searchElement) {
    searchElement = createSearchElement();
    document.body.appendChild(searchElement);
  }
  const input = searchElement.querySelector('input');
  searchElement.hidden = false;
  document.documentElement.classList.add('is-search-open');
  input.select();
  input.focus();

  if (!searchIndex) {
    renderResults(input.value);
    searchIndex = await buildSearchIndex();
  }
  renderResults(input.value);
}

function closeSearch() {
  searchElement.hidden = true;
  document.documentElement.classList.remove('is-search-open');
}

function createSearchElement() {
  const element = document.createElement('div');
  element.className = 'search';
  element.hidden = true;
  element.innerHTML = `
    <div class="search-backdrop" data-search-close></div>
    <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search the documentation">
      <div class="search-field">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.25 4.24-1.42 1.42-4.24-4.25A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>
        <input type="search" placeholder="Search options, guides and examples" autocomplete="off" spellcheck="false"
          role="combobox" aria-expanded="true" aria-controls="search-results" aria-autocomplete="list">
        <kbd>Esc</kbd>
      </div>
      <ul class="search-results" id="search-results" role="listbox" aria-label="Results"></ul>
      <div class="search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span></div>
    </div>`;

  const input = element.querySelector('input');
  input.addEventListener('input', () => renderResults(input.value));
  input.addEventListener('keydown', (e) => {
    const items = [...element.querySelectorAll('.search-result')];
    const current = items.findIndex((item) => item.getAttribute('aria-selected') === 'true');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = items.length
        ? (current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        : -1;
      selectResult(items, next);
    } else if (e.key === 'Enter' && current !== -1) {
      e.preventDefault();
      items[current].querySelector('a').click();
    }
  });
  element.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearch();
    }
  });
  element.addEventListener('click', (e) => {
    if (e.target.closest('[data-search-close]')) {
      closeSearch();
    } else if (e.target.closest('.search-result a')) {
      closeSearch();
    }
  });
  element.addEventListener('mousemove', (e) => {
    const item = e.target.closest('.search-result');
    if (item && item.getAttribute('aria-selected') !== 'true') {
      const items = [...element.querySelectorAll('.search-result')];
      selectResult(items, items.indexOf(item));
    }
  });

  return element;
}

function selectResult(items, index) {
  items.forEach((item, i) => item.setAttribute('aria-selected', String(i === index)));
  items[index]?.scrollIntoView({ block: 'nearest' });
  searchElement.querySelector('input').setAttribute('aria-activedescendant', items[index]?.id || '');
}

function renderResults(query) {
  const list = searchElement.querySelector('.search-results');
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  // Typing goes on while the index loads, and the results show once it has
  if (!searchIndex) {
    list.innerHTML = '<li class="search-empty">Loading the index…</li>';
    return;
  }
  if (!terms.length) {
    list.innerHTML = '<li class="search-empty">Type to search every guide, option, CSS variable and example</li>';
    return;
  }

  const results = searchIndex
    .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  if (!results.length) {
    list.innerHTML = `<li class="search-empty">No results for “${escapeHtml(query)}”</li>`;
    return;
  }

  list.innerHTML = results.map(({ entry }, i) => `
    <li class="search-result" id="search-result-${i}" role="option" aria-selected="${i === 0}">
      <a href="${escapeHtml(entry.url)}">
        <span class="search-result-kind search-result-kind-${entry.kind}">${KIND_LABELS[entry.kind]}</span>
        <span class="search-result-text">
          <span class="search-result-title${entry.kind === 'entry' ? ' is-code' : ''}">${markTerms(entry.title, terms)}</span>
          <span class="search-result-context">${escapeHtml(entry.context)}</span>
        </span>
      </a>
    </li>`).join('');
}

function scoreEntry(entry, terms) {
  const title = entry.title.toLowerCase();
  const text = entry.text.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (title === term) {
      score += 100;
    } else if (title.startsWith(term)) {
      score += 60;
    } else if (title.includes(term)) {
      score += 35;
    } else if (text.includes(term)) {
      score += 8;
    } else {
      return 0;
    }
  }
  return score + entry.weight;
}

function markTerms(text, terms) {
  let html = escapeHtml(text);
  terms.forEach((term) => {
    const escaped = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`(${escaped})(?![^<]*>)`, 'gi'), '<mark>$1</mark>');
  });
  return html;
}

async function buildSearchIndex() {
  const index = [];

  const pages = await Promise.all(PAGES.filter(({ slug }) => slug !== 'changelog').map(async (page) => {
    try {
      return { ...page, markdown: await fetchPageMarkdown(page.slug) };
    } catch {
      return undefined;
    }
  }));

  pages.filter(Boolean).forEach(({ slug, title, markdown }) => {
    const lead = markdown.split('\n\n').find((block) => block.trim() && !block.startsWith('#')) || '';
    index.push({
      kind: 'page', title, context: stripInline(lead).slice(0, 140), text: stripInline(lead), url: getGuideUrl(slug),
      weight: 6,
    });

    markdown.replace(/```[\s\S]*?```/g, '').split('\n').forEach((line) => {
      const heading = line.match(/^(##|###)\s+(.*)$/);
      if (heading) {
        const text = stripInline(heading[2]);
        index.push({
          kind: 'section', title: text, context: title, text: '', url: getGuideUrl(slug, slugify(text)), weight: 3,
        });
      }
    });

    readEntries(markdown).forEach(({ name, anchor, type, summary }) => {
      index.push({
        kind: 'entry',
        title: name,
        context: type ? `${type} · ${title}` : title,
        text: summary,
        url: getGuideUrl(slug, anchor),
        weight: 10,
      });
    });
  });

  try {
    const { EXAMPLES } = await import('../examples/examples.js');
    EXAMPLES.forEach(({ id, title, category, description }) => {
      index.push({
        kind: 'example', title, context: category, text: description, url: getExampleUrl(id), weight: 4,
      });
    });
  } catch {
    // The search goes on without the examples
  }

  return index;
}
