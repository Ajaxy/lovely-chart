// Runs the code of an example or a live block of the guide in an iframe of its own: a page with the library's
// stylesheet, an import map that resolves `lovely-chart`, the skin of the site and a bridge that reports the height of
// the page, its errors and its console back here

import { SITE_ROOT } from './pages.js';

const EXAMPLES_URL = new URL('examples/', SITE_ROOT).href;
const LIBRARY_URL = new URL('LovelyChart.js', SITE_ROOT).href;
const LIBRARY_CSS_URL = new URL('LovelyChart.css', SITE_ROOT).href;
const FRAME_CSS_URL = new URL('site/frame.css', SITE_ROOT).href;
const MESSAGE_SOURCE = 'lovely-chart-frame';
// The markup a page of JavaScript alone mounts its chart in
export const DEFAULT_HTML = '<div id="chart"></div>';

const BRIDGE = `(() => {
  const post = (data) => parent.postMessage({ source: '${MESSAGE_SOURCE}', ...data }, '*');
  const format = (value) => {
    if (value instanceof Error) return value.message;
    if (value && typeof value === 'object') {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
  };
  ['log', 'info', 'warn', 'error'].forEach((level) => {
    const original = console[level];
    console[level] = (...args) => {
      post({ type: 'console', level, text: args.map(format).join(' ') });
      original.apply(console, args);
    };
  });
  addEventListener('error', (e) => {
    if (e instanceof ErrorEvent) {
      post({ type: 'error', text: e.message, line: e.lineno });
    } else if (e.target && e.target !== window) {
      post({ type: 'error', text: 'Failed to load ' + (e.target.src || e.target.href || e.target.tagName) });
    }
  }, true);
  addEventListener('unhandledrejection', (e) => post({ type: 'error', text: format(e.reason) }));
  const reportHeight = () => post({ type: 'height', height: Math.ceil(document.documentElement.getBoundingClientRect().height) });
  new ResizeObserver(reportHeight).observe(document.documentElement);
  addEventListener('load', () => { reportHeight(); post({ type: 'load' }); });
})();`;

const controllers = new Map();

window.addEventListener('message', (e) => {
  if (e.data?.source !== MESSAGE_SOURCE) {
    return;
  }
  controllers.get(e.source)?.handleMessage(e.data);
});

export function isDarkTheme() {
  return document.documentElement.classList.contains('theme-dark');
}

/**
 * The document of a frame that runs `source`, `{ js?, css?, html? }`: the markup of `html`, or a `#chart` element, and
 * the module of `js` after it
 */
export function buildFrameDocument(source, { className = '' } = {}) {
  const { js = '', css = '', html } = source;
  const head = [
    '<!doctype html>',
    `<html lang="en" class="${isDarkTheme() ? 'theme-dark' : ''} ${className}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<base href="${EXAMPLES_URL}">`,
    `<script type="importmap">${JSON.stringify({ imports: { 'lovely-chart': LIBRARY_URL } })}</script>`,
    `<link rel="stylesheet" href="${LIBRARY_CSS_URL}">`,
    `<link rel="stylesheet" href="${FRAME_CSS_URL}">`,
    `<script>${BRIDGE}</script>`,
    css ? `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>` : '',
    '</head>',
    '<body>',
    html ?? DEFAULT_HTML,
  ].join('\n');

  if (!js) {
    return { html: `${head}\n</body>\n</html>`, jsLineOffset: 0 };
  }

  const scriptOpen = '<script type="module">';
  // An error of the module reports its line in the document; the code starts on the line after the opening tag
  const jsLineOffset = head.split('\n').length + 1;
  const script = `${scriptOpen}\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  return { html: `${head}\n${script}\n</body>\n</html>`, jsLineOffset };
}

/**
 * Mounts a frame running `source` in `container`. `onHeight`, `onError`, `onConsole` and `onLoad` receive the reports of
 * the page. `run(source)` loads new code, swapping the frame for a new one once the new page has loaded.
 */
export function mountFrame(container, source, options = {}) {
  const { className, title = 'Example', onHeight, onError, onConsole, onLoad } = options;
  let frame;
  let pendingFrame;
  let isDestroyed = false;

  function createFrame(nextSource) {
    const built = buildFrameDocument(nextSource, { className });
    const element = document.createElement('iframe');
    element.className = 'live-frame';
    element.title = title;
    element.srcdoc = built.html;
    return { element, jsLineOffset: built.jsLineOffset };
  }

  function register(element, jsLineOffset) {
    // The reports of a page that has yet to take the old one's place, delivered once it does
    const held = [];
    const deliver = (data) => {
      if (data.type === 'height') {
        onHeight?.(data.height);
      } else if (data.type === 'error') {
        onError?.({ text: data.text, line: data.line ? data.line - jsLineOffset : undefined });
      } else if (data.type === 'console') {
        onConsole?.(data);
      } else if (data.type === 'load') {
        onLoad?.();
      }
    };

    // The window of a frame exists once it is in the document
    controllers.set(element.contentWindow, {
      handleMessage(data) {
        if (isDestroyed) {
          return;
        }
        if (element === pendingFrame) {
          held.push(data);
          if (data.type === 'load') {
            swapIn(element);
            held.splice(0).forEach(deliver);
          }
          return;
        }
        if (element === frame) {
          deliver(data);
        }
      },
    });
  }

  function swapIn(element) {
    const previous = frame;
    frame = element;
    pendingFrame = undefined;
    element.classList.remove('live-frame-pending');
    forget(previous);
    previous.remove();
  }

  function forget(element) {
    if (element.contentWindow) {
      controllers.delete(element.contentWindow);
    }
  }

  function run(nextSource) {
    if (isDestroyed) {
      return;
    }
    if (pendingFrame) {
      forget(pendingFrame);
      pendingFrame.remove();
    }
    const created = createFrame(nextSource);
    if (!frame) {
      frame = created.element;
      container.appendChild(frame);
      register(frame, created.jsLineOffset);
      return;
    }
    // The old page stays on screen until the new one loads, so a run swaps the chart without a blank frame
    pendingFrame = created.element;
    pendingFrame.classList.add('live-frame-pending');
    container.appendChild(pendingFrame);
    register(pendingFrame, created.jsLineOffset);
  }

  run(source);

  return {
    get element() {
      return frame;
    },
    run,
    destroy() {
      isDestroyed = true;
      [frame, pendingFrame].filter(Boolean).forEach((element) => {
        forget(element);
        element.remove();
      });
    },
  };
}

/**
 * Sets the skin of every frame on the page to that of the site
 */
export function syncFramesTheme() {
  const isDark = isDarkTheme();
  document.querySelectorAll('iframe.live-frame').forEach((frame) => {
    frame.contentDocument?.documentElement.classList.toggle('theme-dark', isDark);
  });
}

/**
 * A page that runs `source` on its own, with the library from a CDN and the demo data from this site
 */
export function buildStandaloneDocument(source, { title = 'LovelyChart example', version = '2' } = {}) {
  const cdn = `https://cdn.jsdelivr.net/npm/lovely-chart@${version}/dist`;
  const absolutize = (code) => code
    .replace(/(['"`])\.\/demo-data\.js\1/g, (_, quote) => `${quote}${EXAMPLES_URL}demo-data.js${quote}`)
    .replace(/(['"`])\.\.\/data\//g, (_, quote) => `${quote}${new URL('data/', SITE_ROOT).href}`);
  const js = absolutize(source.js || '');
  const html = absolutize(source.html ?? DEFAULT_HTML);

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${title}</title>`,
    `  <link rel="stylesheet" href="${cdn}/LovelyChart.css">`,
    `  <link rel="stylesheet" href="${FRAME_CSS_URL}">`,
    `  <script type="importmap">{ "imports": { "lovely-chart": "${cdn}/LovelyChart.js" } }</script>`,
    source.css ? `  <style>\n${indent(source.css.trim(), 4)}\n  </style>` : '',
    '</head>',
    '<body>',
    indent(html.trim(), 2),
    js ? `  <script type="module">\n${indent(js.trim(), 4)}\n  </script>` : '',
    '</body>',
    '</html>',
    '',
  ].filter((line) => line !== '').join('\n');
}

function indent(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((line) => (line ? pad + line : line)).join('\n');
}
