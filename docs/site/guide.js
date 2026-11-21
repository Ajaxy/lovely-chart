// The guide: a page of Markdown at a time, with its live examples, its table of contents and the entries of the
// reference. The static page of each, which `scripts/site.js` builds, comes rendered, and this takes it over; a link to
// another page swaps that page in place.

import { createEditor } from './editor.js';
import { mountFrame } from './frame.js';
import { escapeHtml } from './highlight.js';
import { renderCodeBlock } from './markdown.js';
import {
  DEFAULT_PAGE, fetchPageMarkdown, getGuideSlug, getGuideUrl, getPageMarkdownUrl, PAGES, PUBLIC_URL,
} from './pages.js';
import { openInPlayground } from './playground.js';
import {
  getPageDescription, getPageTitle, ICONS, renderFooter, renderGuideArticle, renderSidebar, renderToc,
} from './render.js';
import { copyText, initSite, showCopied } from './site.js';

const RUN_DELAY = 500;
const SETTLE_TIMEOUT = 2500;
const TOC_OFFSET = 120;
const DEFAULT_FRAME_HEIGHT = 440;
const MINIMAP_FRAME_HEIGHT = 520;

const article = document.querySelector('.guide-article');
const footer = document.querySelector('.guide-footer');
const toc = document.querySelector('.guide-toc');
const sidebar = document.querySelector('.guide-sidebar nav');

let liveControllers = [];
let currentSlug;
// The Markdown of the page on screen, which "Copy page" copies
let currentMarkdown;
let loadVersion = 0;

initSite();
initMenu();
initLinks();
initPageActions();
start();

window.addEventListener('popstate', () => loadPage(readSlug(), readHash()));
window.addEventListener('hashchange', () => markTarget(readHash() ? document.getElementById(readHash()) : undefined));
window.addEventListener('scroll', () => requestAnimationFrame(updateActiveTocLink), { passive: true });

function start() {
  const slug = readSlug();
  if (!sidebar.children.length) {
    sidebar.innerHTML = renderSidebar(undefined);
  }
  if (article.dataset.slug === slug) {
    hydratePage(slug, readHash());
  } else {
    loadPage(slug, readHash());
  }
}

function readSlug() {
  return getGuideSlug(window.location.href) || DEFAULT_PAGE;
}

function readHash() {
  return decodeURIComponent(window.location.hash.slice(1));
}

function initMenu() {
  document.querySelector('[data-menu-toggle]')?.addEventListener('click', () => {
    const isOpen = document.documentElement.classList.toggle('is-menu-open');
    document.querySelector('[data-menu-toggle]').setAttribute('aria-expanded', String(isOpen));
  });
  document.addEventListener('click', (e) => {
    if (document.documentElement.classList.contains('is-menu-open')
      && !e.target.closest('.guide-sidebar, [data-menu-toggle]')) {
      closeMenu();
    }
  });
}

function closeMenu() {
  document.documentElement.classList.remove('is-menu-open');
  document.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
}

// A link to another page of the guide swaps the page in place, keeping the skin and the scroll of the sidebar
function initLinks() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
      || link.target === '_blank') {
      return;
    }
    const url = new URL(link.href, window.location.href);
    const slug = getGuideSlug(url);
    if (url.origin !== window.location.origin || !PAGES.some((page) => page.slug === slug)) {
      return;
    }
    if (slug === currentSlug && url.pathname === window.location.pathname) {
      return;
    }
    e.preventDefault();
    window.history.pushState(undefined, '', url.href);
    loadPage(slug, decodeURIComponent(url.hash.slice(1)));
  });
}

// "Copy page" copies the Markdown of the page, and its menu closes once the reader picks from it or looks away
function initPageActions() {
  document.addEventListener('click', async (e) => {
    document.querySelectorAll('.page-menu[open]').forEach((menu) => {
      if (!menu.contains(e.target) || e.target.closest('.page-menu-list a')) {
        menu.open = false;
      }
    });

    const button = e.target.closest('[data-copy-page]');
    if (!button || !currentSlug) {
      return;
    }
    currentMarkdown ??= fetchPageMarkdown(currentSlug);
    await copyText(await currentMarkdown);
    showCopied(button);
  });
}

// A page that came rendered takes its live examples from the sources its page holds
function hydratePage(slug, hash) {
  currentSlug = slug;
  currentMarkdown = fetchPageMarkdown(slug);
  currentMarkdown.catch(() => {
    currentMarkdown = undefined;
  });
  const sources = document.getElementById('live-sources');
  showPage(sources ? JSON.parse(sources.textContent) : [], hash, loadVersion, { isScrolledByBrowser: true });
}

async function loadPage(slug, hash) {
  const version = ++loadVersion;
  const page = PAGES.find((candidate) => candidate.slug === slug);
  closeMenu();

  if (!page) {
    renderMissing(slug);
    return;
  }

  article.classList.add('is-loading');
  let markdown;
  try {
    markdown = await fetchPageMarkdown(slug);
  } catch {
    if (version === loadVersion) {
      renderMissing(slug);
    }
    return;
  }
  if (version !== loadVersion) {
    return;
  }

  currentSlug = slug;
  currentMarkdown = Promise.resolve(markdown);
  destroyLiveBlocks();

  const { html, headings, liveSources } = renderGuideArticle(page, markdown);
  article.innerHTML = html;
  article.dataset.slug = slug;
  article.classList.remove('is-loading');
  toc.innerHTML = renderToc(headings);
  footer.innerHTML = renderFooter(page);
  updateHead(page, markdown);
  showPage(liveSources, hash, version);
}

// Mounts the live examples and the filter of the page on screen, and scrolls to the target of the URL
async function showPage(liveSources, hash, version, { isScrolledByBrowser = false } = {}) {
  addEntryFilter();
  updateActiveTocLink();
  updateSidebar(currentSlug);

  const settled = Promise.all([...article.querySelectorAll('[data-live]')].map((figure) => (
    mountLiveBlock(figure, liveSources[Number(figure.dataset.live)])
  )));

  if (hash || !isScrolledByBrowser) {
    scrollToHash(hash);
  }
  if (hash && liveSources.length) {
    // Charts above the target grow as they load, so the page scrolls to it again once they have
    await Promise.race([settled, new Promise((resolve) => setTimeout(resolve, SETTLE_TIMEOUT))]);
    if (version === loadVersion && readHash() === hash) {
      scrollToHash(hash);
    }
  }
}

// The title, the description and the links of the page in the head of the document, as its static page has them
function updateHead(page, markdown) {
  document.title = getPageTitle(page);
  document.querySelector('meta[name="description"]')?.setAttribute('content', getPageDescription(page, markdown));
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', getGuideUrl(page.slug, undefined, PUBLIC_URL));
  document.querySelector('link[rel="alternate"][type="text/markdown"]')
    ?.setAttribute('href', getPageMarkdownUrl(page.slug));
}

function renderMissing(slug) {
  currentSlug = undefined;
  currentMarkdown = undefined;
  destroyLiveBlocks();
  article.classList.remove('is-loading');
  delete article.dataset.slug;
  article.innerHTML = `<div class="guide-error"><h1>Page not found</h1>
    <p>There is no page “${escapeHtml(slug)}” in the guide. Try the <a href="${getGuideUrl(DEFAULT_PAGE)}">introduction</a>
    or search with <kbd>/</kbd>.</p></div>`;
  footer.innerHTML = '';
  toc.innerHTML = '';
  document.title = 'Page not found · LovelyChart';
  updateSidebar(undefined);
}

function scrollToHash(hash) {
  const target = hash ? document.getElementById(hash) : undefined;
  markTarget(target);
  if (target) {
    target.scrollIntoView();
  } else {
    window.scrollTo(0, 0);
  }
}

// An entry of the reference that a link leads to stands out, as `:target` marks it on a page loaded with its hash
function markTarget(target) {
  article.querySelector('.is-target')?.classList.remove('is-target');
  target?.closest('.api-entry')?.classList.add('is-target');
}

// A page of the reference filters its entries by name and description
function addEntryFilter() {
  const entries = [...article.querySelectorAll('.api-entry')];
  if (entries.length < 8) {
    return;
  }

  const filter = document.createElement('div');
  filter.className = 'api-filter';
  filter.innerHTML = `<input type="search" placeholder="Filter ${entries.length} entries…" aria-label="Filter the entries"
    autocomplete="off" spellcheck="false">`;
  const empty = document.createElement('p');
  empty.className = 'api-empty';
  empty.textContent = 'No entry matches the filter.';
  empty.hidden = true;

  const firstHeading = article.querySelector('h2');
  article.insertBefore(filter, firstHeading);
  article.appendChild(empty);

  filter.querySelector('input').addEventListener('input', (e) => {
    const terms = e.target.value.toLowerCase().split(/\s+/).filter(Boolean);
    let visibleCount = 0;
    entries.forEach((entry) => {
      const isVisible = terms.every((term) => entry.dataset.search.includes(term));
      entry.hidden = !isVisible;
      visibleCount += Number(isVisible);
    });
    empty.hidden = visibleCount > 0;
  });
}

function updateActiveTocLink() {
  const links = [...toc.querySelectorAll('a')];
  if (!links.length) {
    return;
  }
  let active;
  links.forEach((link) => {
    const heading = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (heading && heading.getBoundingClientRect().top < TOC_OFFSET) {
      active = link;
    }
  });
  links.forEach((link) => link.classList.toggle('is-active', link === (active || links[0])));
}

function updateSidebar(slug) {
  sidebar.querySelectorAll('a').forEach((link) => {
    if (link.dataset.slug === slug) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  sidebar.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' });
}

function destroyLiveBlocks() {
  liveControllers.forEach((controller) => controller.destroy());
  liveControllers = [];
}

// A live block runs its code above the code, which the reader can edit in place or take to the playground
function mountLiveBlock(figure, source) {
  const language = source.html !== undefined ? 'html' : 'js';
  const code = source[language];
  figure.innerHTML = `
    <div class="live-preview"></div>
    <div class="live-toolbar">
      <span class="live-label">Live example</span>
      <button class="button" type="button" data-action="edit" aria-pressed="false">${ICONS.edit}<span>Edit</span></button>
      <button class="button" type="button" data-action="copy">${ICONS.copy}<span>Copy</span></button>
      <button class="button" type="button" data-action="open">${ICONS.open}<span>Playground</span></button>
    </div>
    ${renderCodeBlock(language, code)}`;

  const preview = figure.querySelector('.live-preview');
  let currentSource = source;
  let errorElement;
  let editor;
  let runTimeout;
  let resolveSettled;
  const settled = new Promise((resolve) => {
    resolveSettled = resolve;
  });

  const controller = mountFrame(preview, source, {
    title: 'Live example',
    onHeight(height) {
      controller.element.style.height = `${height}px`;
      resolveSettled();
    },
    onLoad() {
      showError(undefined);
    },
    onError(error) {
      showError(error);
      resolveSettled();
    },
  });
  controller.element.style.height = `${/withMinimap:\s*true/.test(code) ? MINIMAP_FRAME_HEIGHT : DEFAULT_FRAME_HEIGHT}px`;
  liveControllers.push(controller);

  function showError(error) {
    errorElement?.remove();
    errorElement = undefined;
    if (!error) {
      return;
    }
    errorElement = document.createElement('pre');
    errorElement.className = 'live-error';
    errorElement.textContent = error.line > 0 ? `Line ${error.line}: ${error.text}` : error.text;
    preview.after(errorElement);
  }

  figure.querySelector('.live-toolbar').addEventListener('click', async (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) {
      return;
    }
    const { action } = button.dataset;
    if (action === 'copy') {
      await copyText(currentSource[language]);
      showCopied(button);
    } else if (action === 'open') {
      openInPlayground(currentSource);
    } else if (action === 'edit') {
      toggleEditor(button);
    }
  });

  function toggleEditor(button) {
    const codeBlock = figure.querySelector('.code-block');
    if (!editor) {
      editor = createEditor(figure, {
        value: currentSource[language],
        language,
        label: 'Code of the live example',
        onChange(value) {
          currentSource = { [language]: value };
          clearTimeout(runTimeout);
          runTimeout = setTimeout(() => controller.run(currentSource), RUN_DELAY);
        },
        onRun() {
          clearTimeout(runTimeout);
          controller.run(currentSource);
        },
      });
      editor.element.hidden = true;
    }
    const isEditing = editor.element.hidden;
    editor.element.hidden = !isEditing;
    codeBlock.hidden = isEditing;
    button.setAttribute('aria-pressed', String(isEditing));
    if (isEditing) {
      editor.setValue(currentSource[language]);
      editor.focus();
    } else {
      codeBlock.outerHTML = renderCodeBlock(language, currentSource[language]);
      figure.querySelector('.code-block').after(editor.element);
    }
  }

  return settled;
}
