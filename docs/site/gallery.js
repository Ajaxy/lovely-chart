// The examples: a gallery of live previews by category, and a workbench where an example's code runs as the reader
// edits it, with its console, its errors and links to the reference of the options it uses

import { CATEGORIES, EXAMPLES, PLAYGROUND_SOURCE } from '../examples/examples.js';
import { readEntries } from './api.js';
import { createEditor } from './editor.js';
import { buildFrameDocument, buildStandaloneDocument, mountFrame } from './frame.js';
import { escapeHtml } from './highlight.js';
import { renderInline } from './markdown.js';
import {
  fetchPageMarkdown, getExampleUrl, getGuideUrl, resolveGuideLink, SITE_ROOT,
} from './pages.js';
import { readPlayground, savePlayground } from './playground.js';
import { copyText, initSite, showCopied } from './site.js';

const PARTS = [['js', 'JavaScript'], ['css', 'CSS'], ['html', 'HTML']];
// The size of the page a preview renders in, which `scripts/thumbnails.js` renders the images at too
const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 500;
const RUN_DELAY = 600;
const MAX_CONSOLE_LINES = 200;
const PLAYGROUND_ID = 'playground';

const ICONS = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 5.3a1 1 0 0 1 0 1.4L9.41 12l5.3 5.3a1 1 0 0 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.42 0Z"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 1-7.75 10h2.08A6 6 0 1 0 8 7.76V10H3V5h2v1.36A7.97 7.97 0 0 1 12 4Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h10a3 3 0 0 1 3 3v10a1 1 0 1 1-2 0V6a1 1 0 0 0-1-1H8a1 1 0 0 1 0-2Zm-2 4h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6Z"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a1 1 0 0 1 1 1v9.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V4a1 1 0 0 1 1-1ZM4 19a1 1 0 0 1 1 1h14a1 1 0 1 1 2 0 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 1 1 0 0 1 1-1Z"/></svg>',
  open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V6.41l-8.3 8.3a1 1 0 0 1-1.4-1.42L17.58 5H14a1 1 0 1 1 0-2ZM5 7a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5a1 1 0 1 1 2 0v5a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h5a1 1 0 1 1 0 2H5Z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5.14v13.72a1 1 0 0 0 1.52.85l11.02-6.86a1 1 0 0 0 0-1.7L7.52 4.29A1 1 0 0 0 6 5.14Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.25 4.24-1.42 1.42-4.24-4.25A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>',
};

const app = document.getElementById('app');

initSite();
const id = new URLSearchParams(window.location.search).get('id');
if (id) {
  renderWorkbench(id);
} else {
  renderGallery();
}

function getSourceUrl(exampleId, part) {
  return new URL(`examples/code/${exampleId}.${part}`, SITE_ROOT).href;
}

function getThumbnailUrl(exampleId, skin) {
  return new URL(`examples/thumbnails/${exampleId}-${skin}.webp`, SITE_ROOT).href;
}

async function fetchSource(example) {
  const parts = example.parts || ['js'];
  const entries = await Promise.all(parts.map(async (part) => {
    const response = await fetch(getSourceUrl(example.id, part));
    if (!response.ok) {
      throw new Error(`The ${part} of the example “${example.id}” is missing`);
    }
    return [part, await response.text()];
  }));
  return Object.fromEntries(entries);
}

/* Gallery */

function renderGallery() {
  document.title = 'LovelyChart: Telegram-style charts for the web';
  const counts = Object.fromEntries(CATEGORIES.map((category) => [
    category, EXAMPLES.filter((example) => example.category === category).length,
  ]));

  app.innerHTML = `
    <div class="gallery">
      <header class="gallery-hero">
        <h1>Examples</h1>
        <p class="gallery-intro">LovelyChart is a small, dependency-free library of Telegram-style interactive charts
          for the web, minimalist and lovely out of the box. Give it an element and your data, and it draws a line,
          area, bar, step, pie or donut chart on canvas, with a tooltip, a legend, a draggable minimap and drill-down
          zooming built in.</p>
        <p>${EXAMPLES.length} live examples of every chart type and feature. Hover them, drag their minimaps, click to
          zoom, then open one to edit its code and watch the chart follow as you type.</p>
        <div class="gallery-tools">
          <label class="gallery-search">
            ${ICONS.search}
            <input type="search" placeholder="Filter examples" aria-label="Filter examples" autocomplete="off">
          </label>
          <a class="button button-primary" href="${getExampleUrl(PLAYGROUND_ID)}">${ICONS.play}<span>Open the playground</span></a>
        </div>
        <div class="gallery-chips" role="group" aria-label="Categories">
          <button type="button" class="chip" data-category="" aria-pressed="true">All <span>${EXAMPLES.length}</span></button>
          ${CATEGORIES.map((category) => `
            <button type="button" class="chip" data-category="${escapeHtml(category)}" aria-pressed="false">
              ${escapeHtml(category)} <span>${counts[category]}</span>
            </button>`).join('')}
        </div>
      </header>
      ${CATEGORIES.map((category) => `
        <section class="gallery-section" data-category="${escapeHtml(category)}">
          <h2>${escapeHtml(category)}</h2>
          <div class="gallery-grid">
            ${EXAMPLES.filter((example) => example.category === category).map(renderCard).join('')}
          </div>
        </section>`).join('')}
      <p class="gallery-empty" hidden>No example matches the filter.</p>
    </div>`;

  initGalleryFilters();
  initThumbnails();
}

// A card shows the image of its preview in the skin on screen, or runs a preview that moves by itself live
function renderCard(example) {
  const images = example.isPreviewLive ? '' : ['day', 'night'].map((skin) => `
    <img class="example-thumb-${skin}" src="${getThumbnailUrl(example.id, skin)}" alt="" loading="lazy"
      width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}">`).join('');
  return `
    <article class="example-card" data-id="${example.id}"
      data-search="${escapeHtml(`${example.title} ${example.category} ${example.description}`.toLowerCase())}">
      <div class="example-thumb" aria-hidden="true">${images}</div>
      <div class="example-card-body">
        <h3><a href="${getExampleUrl(example.id)}">${escapeHtml(example.title)}</a></h3>
        <p>${renderInline(example.description)}</p>
      </div>
    </article>`;
}

function initGalleryFilters() {
  const input = app.querySelector('.gallery-search input');
  const chips = [...app.querySelectorAll('.chip')];
  let category = '';

  const apply = () => {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    let visibleCount = 0;
    app.querySelectorAll('.gallery-section').forEach((section) => {
      let sectionCount = 0;
      section.querySelectorAll('.example-card').forEach((card) => {
        const isVisible = (!category || section.dataset.category === category)
          && terms.every((term) => card.dataset.search.includes(term));
        card.hidden = !isVisible;
        sectionCount += Number(isVisible);
      });
      section.hidden = sectionCount === 0;
      visibleCount += sectionCount;
    });
    app.querySelector('.gallery-empty').hidden = visibleCount > 0;
  };

  input.addEventListener('input', apply);
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      category = chip.dataset.category;
      chips.forEach((other) => other.setAttribute('aria-pressed', String(other === chip)));
      apply();
    });
  });
}

// A live preview runs once its card nears the screen, at the size of the page the images render at, scaled down to the
// card. An example with no image yet, as a new one before `npm run thumbnails`, runs live too.
function initThumbnails() {
  const gallery = app.querySelector('.gallery');
  const resizeObserver = new ResizeObserver(([entry]) => {
    const thumb = entry.target;
    gallery.style.setProperty('--thumb-scale', String(thumb.clientWidth / THUMBNAIL_WIDTH));
  });
  resizeObserver.observe(app.querySelector('.example-thumb'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(async ({ isIntersecting, target }) => {
      if (!isIntersecting) {
        return;
      }
      observer.unobserve(target);
      const example = EXAMPLES.find((candidate) => candidate.id === target.closest('.example-card').dataset.id);
      try {
        const source = await fetchSource(example);
        const controller = mountFrame(target, source, { className: 'frame-thumbnail', title: example.title });
        controller.element.tabIndex = -1;
      } catch {
        target.classList.add('is-failed');
      }
    });
  }, { rootMargin: '400px 0px' });

  app.querySelectorAll('.example-thumb').forEach((thumb) => {
    const images = thumb.querySelectorAll('img');
    if (!images.length) {
      observer.observe(thumb);
      return;
    }
    images.forEach((image) => {
      image.addEventListener('load', () => thumb.classList.add('is-loaded'), { once: true });
      image.addEventListener('error', () => {
        thumb.replaceChildren();
        observer.observe(thumb);
      }, { once: true });
    });
  });
}

/* Workbench */

async function renderWorkbench(exampleId) {
  const isPlayground = exampleId === PLAYGROUND_ID;
  const index = EXAMPLES.findIndex((example) => example.id === exampleId);
  const example = isPlayground
    ? {
      id: PLAYGROUND_ID,
      title: 'Playground',
      category: 'Playground',
      description: 'Write any chart from scratch. The code stays in this browser as you type, and **Reset** brings back '
        + 'the starting chart.',
      parts: ['js', 'css', 'html'],
    }
    : EXAMPLES[index];

  if (!example) {
    renderMissing(exampleId);
    return;
  }

  document.title = `${example.title} · Examples · LovelyChart`;
  let original;
  try {
    original = isPlayground ? PLAYGROUND_SOURCE : await fetchSource(example);
  } catch (err) {
    renderMissing(exampleId, err.message);
    return;
  }
  let source = { ...original, ...(isPlayground ? readPlayground() : undefined) };
  const parts = PARTS.filter(([part]) => source[part] !== undefined || (isPlayground && part !== 'html'));
  let activePart = 'js';

  app.innerHTML = `
    <div class="workbench">
      <div class="workbench-bar">
        <a class="button" href="${getExampleUrl()}">${ICONS.back}<span>Examples</span></a>
        <div class="workbench-title">
          <span>${escapeHtml(example.category)}</span>
          <h1>${escapeHtml(example.title)}</h1>
        </div>
        <div class="workbench-actions">
          <button class="button" type="button" data-action="reset" title="Restore the original code">${ICONS.reset}<span>Reset</span></button>
          <button class="button" type="button" data-action="copy" title="Copy the code of this tab">${ICONS.copy}<span>Copy</span></button>
          <button class="button" type="button" data-action="download" title="Download a page that runs this example on its own">${ICONS.download}<span>HTML</span></button>
          <button class="button" type="button" data-action="open" title="Open the preview in a new tab">${ICONS.open}<span>Preview</span></button>
        </div>
      </div>
      <div class="workbench-main">
        <section class="workbench-code" aria-label="Code">
          <div class="workbench-tabs" role="tablist" aria-label="Files">
            ${parts.map(([part, label]) => `
              <button type="button" role="tab" data-part="${part}" aria-selected="${part === activePart}">${label}</button>`).join('')}
            <span class="workbench-hint"><kbd>${navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl'}</kbd><kbd>↵</kbd> runs</span>
            <button class="button button-primary workbench-run" type="button" data-action="run">${ICONS.play}<span>Run</span></button>
          </div>
          <div class="workbench-editor"></div>
        </section>
        <section class="workbench-preview" aria-label="Preview">
          <div class="workbench-frame"></div>
          <div class="workbench-console" hidden>
            <div class="workbench-console-head"><span>Console</span><button class="button" type="button" data-action="clear">Clear</button></div>
            <ol class="workbench-console-lines"></ol>
          </div>
        </section>
      </div>
      <div class="workbench-info">
        <div class="workbench-about prose">
          <p>${renderInline(example.description, { options: { resolveLink: resolveGuideLink } })}</p>
          <div class="workbench-options" hidden><h2>Options in this example</h2><p class="workbench-option-list"></p></div>
        </div>
        ${isPlayground ? '' : renderPager(index)}
      </div>
    </div>`;

  const consoleElement = app.querySelector('.workbench-console');
  const consoleLines = app.querySelector('.workbench-console-lines');
  const frameContainer = app.querySelector('.workbench-frame');
  let runTimeout;

  const frame = mountFrame(frameContainer, source, {
    title: `${example.title} preview`,
    onHeight(height) {
      frame.element.style.height = `${height}px`;
    },
    onError({ text, line }) {
      addConsoleLine('error', line > 0 ? `${text} (line ${line})` : text);
    },
    onConsole({ level, text }) {
      addConsoleLine(level, text);
    },
  });

  const editor = createEditor(app.querySelector('.workbench-editor'), {
    value: source[activePart],
    language: activePart,
    label: `${example.title}: JavaScript`,
    onChange(value) {
      source = { ...source, [activePart]: value };
      if (isPlayground) {
        savePlayground(source);
      }
      updateOptions();
      clearTimeout(runTimeout);
      runTimeout = setTimeout(run, RUN_DELAY);
    },
    onRun: run,
  });

  function run() {
    clearTimeout(runTimeout);
    consoleLines.replaceChildren();
    consoleElement.hidden = true;
    frame.run(source);
  }

  function addConsoleLine(level, text) {
    const line = document.createElement('li');
    line.className = `console-line console-line-${level}`;
    line.textContent = text;
    consoleLines.appendChild(line);
    while (consoleLines.childElementCount > MAX_CONSOLE_LINES) {
      consoleLines.firstChild.remove();
    }
    consoleElement.hidden = false;
    consoleLines.scrollTop = consoleLines.scrollHeight;
  }

  app.querySelector('.workbench-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab) {
      return;
    }
    activePart = tab.dataset.part;
    app.querySelectorAll('[role="tab"]').forEach((other) => other.setAttribute('aria-selected', String(other === tab)));
    editor.setValue(source[activePart] ?? '', activePart);
    editor.focus();
  });

  app.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) {
      return;
    }
    const { action } = button.dataset;
    if (action === 'run') {
      run();
    } else if (action === 'clear') {
      consoleLines.replaceChildren();
      consoleElement.hidden = true;
    } else if (action === 'reset') {
      source = { ...original };
      if (isPlayground) {
        savePlayground(source);
      }
      editor.setValue(source[activePart] ?? '', activePart);
      updateOptions();
      run();
    } else if (action === 'copy') {
      await copyText(source[activePart] ?? '');
      showCopied(button);
    } else if (action === 'download') {
      downloadStandalone(example, source);
    } else if (action === 'open') {
      const url = URL.createObjectURL(new Blob([buildFrameDocument(source).html], { type: 'text/html' }));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  });

  const optionLinks = await readOptionLinks();
  function updateOptions() {
    const code = `${source.js || ''}\n${source.html || ''}`;
    const used = optionLinks.filter(({ pattern }) => pattern.test(code));
    const container = app.querySelector('.workbench-options');
    container.hidden = used.length === 0;
    container.querySelector('.workbench-option-list').innerHTML = used.map(({ name, url }) => (
      `<a class="option-chip" href="${url}"><code>${escapeHtml(name)}</code></a>`
    )).join('');
  }
  updateOptions();
}

function renderPager(index) {
  const previous = EXAMPLES[index - 1];
  const next = EXAMPLES[index + 1];
  return `
    <nav class="pager" aria-label="Examples">
      ${previous ? `<a class="pager-previous" href="${getExampleUrl(previous.id)}"><span>Previous</span>${escapeHtml(previous.title)}</a>` : ''}
      ${next ? `<a class="pager-next" href="${getExampleUrl(next.id)}"><span>Next</span>${escapeHtml(next.title)}</a>` : ''}
    </nav>`;
}

function renderMissing(exampleId, message) {
  document.title = 'Example not found · LovelyChart';
  app.innerHTML = `<div class="gallery prose"><h1>Example not found</h1>
    <p>${escapeHtml(message || `There is no example “${exampleId}”.`)} See <a href="${getExampleUrl()}">all examples</a>.</p></div>`;
}

function downloadStandalone(example, source) {
  const html = buildStandaloneDocument(source, { title: `${example.title} · LovelyChart` });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  link.download = `lovely-chart-${example.id}.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// The options and methods of the reference, each with a pattern that finds it in code
async function readOptionLinks() {
  let markdown;
  try {
    markdown = await fetchPageMarkdown('api');
  } catch {
    return [];
  }
  const links = [];
  readEntries(markdown).forEach(({ name, anchor }) => {
    const isMethod = name.includes('(');
    const key = name.replace(/\(.*$/, '').replace(/^.*\]\./, '');
    if (!/^[A-Za-z_$][\w$]*$/.test(key) || links.some((link) => link.name === key)) {
      return;
    }
    const pattern = isMethod
      ? new RegExp(`\\.${key}\\(`)
      : new RegExp(`(?<![\\w$.])${key}(?:\\s*:|\\s*[,}])`);
    links.push({ name: key, url: getGuideUrl('api', anchor), pattern });
  });
  return links;
}
