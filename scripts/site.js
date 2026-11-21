/**
 * Builds the files of the site that come from its sources, which `npm run demo` runs before the site is published:
 * - the page of each page of the guide, `docs/guide/<slug>.html` and `docs/guide/index.html` for the first, rendered
 *   from its Markdown into `docs/site/guide.html`, so that a reader, a crawler or an assistant without JavaScript gets
 *   the page, which the browser then takes over
 * - `docs/llms.txt`, the index of the docs for a language model, as https://llmstxt.org describes it, and
 *   `docs/llms-full.txt`, every page of the guide in one file
 * - `docs/sitemap.xml`
 *
 * The dev server of `npm run dev` serves the same files on request, from `buildSiteFile()`, so they follow the Markdown
 * as it is edited.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXAMPLES } from '../docs/examples/examples.js';
import { escapeHtml } from '../docs/site/highlight.js';
import {
  DEFAULT_PAGE, getExampleUrl, getGuidePath, getGuideUrl, getPageMarkdownUrl, PAGES, PUBLIC_URL, REPOSITORY_URL,
  resolveGuideLink, SECTIONS, SITE_ROOT,
} from '../docs/site/pages.js';
import {
  getPageDescription, getPageTitle, renderFooter, renderGuideArticle, renderSidebar, renderToc,
} from '../docs/site/render.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const TEMPLATE = path.join(DOCS, 'site/guide.html');
const PREVIEW_URL = new URL('preview.png', PUBLIC_URL).href;
const TYPES = {
  html: 'text/html; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
};

// What a language model most needs to know before it reads a page, at the top of `llms.txt` and `llms-full.txt`
const SUMMARY = 'LovelyChart is a dependency-free JavaScript library of interactive charts for the web, written in '
  + 'TypeScript: line, area, bar, step, pie and donut charts drawn on canvas, with a tooltip, a legend, a draggable '
  + 'minimap, drill-down zooming, annotations, day and night skins and colours from CSS variables.';
const FACTS = [
  'Key facts:',
  '',
  '- Install with `npm install lovely-chart`. The package is one ES module with its TypeScript declarations and no '
  + 'dependencies; there is no CommonJS or UMD build.',
  '- Import the class, the default export, and the stylesheet once: `import LovelyChart from \'lovely-chart\'` and '
  + '`import \'lovely-chart/LovelyChart.css\'`. A chart needs the stylesheet.',
  '- Build a chart with `new LovelyChart(element, { type, labels, datasets })`: `type` is `line`, `area`, `bar`, '
  + '`step`, `pie` or `donut`; `labels` are UNIX timestamps in milliseconds, or strings; each dataset is '
  + '`{ name, values }`, with `values[i]` at `labels[i]`.',
  '- The instance has `update(newData, options?)`, `destroy()` and a few more methods to drive it.',
  '- The chart fills the width of its element and builds again when the width of the window changes, not when only '
  + 'the element resizes.',
  '- The `theme-dark` class on `<html>` switches the chart to its night skin, or `colorScheme: \'system\'` follows '
  + 'the system setting.',
  '- The examples of these docs import `./demo-data.js` and fetch `../data/*.json`, which are helpers of the docs at '
  + `${new URL('examples/demo-data.js', PUBLIC_URL).href} and ${new URL('data/', PUBLIC_URL).href}, `
  + 'not part of the package.',
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildSite();
}

/**
 * Writes every file the site builds into `docs/`
 */
export function buildSite() {
  const files = getSitePaths();
  files.forEach((urlPath) => {
    const file = path.join(DOCS, urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);
    fs.writeFileSync(file, buildSiteFile(urlPath).body);
  });
  console.log(`${files.length} files of the site in ${path.relative(ROOT, DOCS)}`);
}

/**
 * The content and the type of the file the site serves at `urlPath`, from its root, as `/guide/tooltip` or
 * `/llms.txt`, or `undefined` for a path the site builds no file for
 */
export function buildSiteFile(urlPath) {
  const relativePath = urlPath.replace(/^\//, '');
  if (relativePath === 'llms.txt') {
    return { body: buildLlmsTxt(), type: TYPES.txt };
  }
  if (relativePath === 'llms-full.txt') {
    return { body: buildLlmsFullTxt(), type: TYPES.txt };
  }
  if (relativePath === 'sitemap.xml') {
    return { body: buildSitemap(), type: TYPES.xml };
  }
  const guidePage = relativePath.match(/^guide\/(?:([\w-]+?)(?:\.html)?)?$/);
  const slug = guidePage && (!guidePage[1] || guidePage[1] === 'index' ? DEFAULT_PAGE : guidePage[1]);
  if (slug && PAGES.some((page) => page.slug === slug)) {
    return { body: buildGuidePage(slug), type: TYPES.html };
  }
  return undefined;
}

// The paths of the files `buildSite()` writes: the first page at `guide/` and at its own name, as its Markdown is
function getSitePaths() {
  return [
    ...PAGES.map(({ slug }) => (slug === DEFAULT_PAGE ? 'guide/' : `guide/${slug}.html`)),
    `guide/${DEFAULT_PAGE}.html`,
    'llms.txt',
    'llms-full.txt',
    'sitemap.xml',
  ];
}

function buildGuidePage(slug) {
  const page = PAGES.find((candidate) => candidate.slug === slug);
  const markdown = readPageMarkdown(slug);
  const { html, headings, liveSources } = renderGuideArticle(page, markdown);
  // The sources of the live examples, for the browser to run, safe inside a `<script>`
  const sources = JSON.stringify(liveSources).replace(/</g, '\\u003c');
  const values = {
    title: escapeHtml(getPageTitle(page)),
    pageTitle: escapeHtml(page.title),
    description: escapeHtml(getPageDescription(page, markdown)),
    canonicalUrl: getGuideUrl(slug, undefined, PUBLIC_URL),
    markdownUrl: getPageMarkdownUrl(slug),
    imageUrl: PREVIEW_URL,
    slug,
    sidebar: renderSidebar(slug),
    article: html,
    toc: renderToc(headings),
    footer: renderFooter(page),
    liveSources: liveSources.length ? `<script type="application/json" id="live-sources">${sources}</script>` : '',
  };
  // The URLs of the site, which the modules of the site make absolute, lead from the folder of the guide
  return fs.readFileSync(TEMPLATE, 'utf8')
    .replace(/{{(\w+)}}/g, (match, key) => values[key] ?? match)
    .replaceAll(SITE_ROOT, '../');
}

function buildLlmsTxt() {
  const lines = ['# LovelyChart', '', `> ${SUMMARY}`, '', ...FACTS, ''];
  lines.push(
    `Every page below is Markdown; the same page for a browser is at the same URL without \`.md\`. `
    + `[llms-full.txt](${new URL('llms-full.txt', PUBLIC_URL).href}) has all of them in one file.`,
    '',
  );

  SECTIONS.forEach(({ title, pages }) => {
    const listed = pages.filter(({ slug }) => slug !== 'changelog');
    lines.push(`## ${title}`, '');
    listed.forEach((page) => {
      const description = getPageDescription(page, readPageMarkdown(page.slug), { isMarkdown: true });
      lines.push(`- [${page.title}](${getPageMarkdownUrl(page.slug, PUBLIC_URL)}): ${description}`);
    });
    lines.push('');
  });

  lines.push(
    '## Examples',
    '',
    'The code of each example of the gallery, a module that builds its chart in `<div id="chart">` unless it has a '
    + 'page of its own (`.html`), with the styles of some in `.css` beside it.',
    '',
  );
  EXAMPLES.forEach(({ id, title, description, parts = ['js'] }) => {
    const [main, ...others] = parts.map((part) => new URL(`examples/code/${id}.${part}`, PUBLIC_URL).href);
    const also = others.length ? ` Also ${others.map((url) => `<${url}>`).join(' and ')}.` : '';
    lines.push(`- [${title}](${main}): ${description}${also}`);
  });

  lines.push(
    '',
    '## Optional',
    '',
    `- [Changelog](${new URL('CHANGELOG.md', PUBLIC_URL).href}): the changes of each release`,
    `- [Examples gallery](${getExampleUrl(undefined).replace(SITE_ROOT, PUBLIC_URL)}): every example live and `
    + 'editable, for a browser',
    `- [Source code](${REPOSITORY_URL}): the repository, with the TypeScript source in \`src/\``,
    '',
  );
  return lines.join('\n');
}

function buildLlmsFullTxt() {
  const pages = PAGES.filter(({ slug }) => slug !== 'changelog').map((page) => {
    const source = getPageMarkdownUrl(page.slug, PUBLIC_URL);
    return `<!-- Source: ${source} -->\n\n${absolutizeLinks(readPageMarkdown(page.slug).trim())}`;
  });
  return [`# LovelyChart documentation\n\n> ${SUMMARY}\n\n${FACTS.join('\n')}`, ...pages].join('\n\n---\n\n') + '\n';
}

/**
 * A page for `llms-full.txt`, where the links between the pages lead to their Markdown on the site, and the live
 * examples are plain code
 */
function absolutizeLinks(markdown) {
  return markdown.split(/(^```[^\n]*\n[\s\S]*?^```)/m).map((part, i) => {
    if (i % 2) {
      return part.replace(/^```(\w+) live/, '```$1');
    }
    return part.replace(/\]\(([^)\s]+)\)/g, (match, href) => {
      const pageLink = href.match(/^(?:\.\/)?([\w-]+)\.md(#.*)?$/);
      if (pageLink && PAGES.some(({ slug }) => slug === pageLink[1])) {
        return `](${getPageMarkdownUrl(pageLink[1], PUBLIC_URL)}${pageLink[2] || ''})`;
      }
      return `](${resolveGuideLink(href).replace(SITE_ROOT, PUBLIC_URL)})`;
    });
  }).join('');
}

function buildSitemap() {
  const urls = [
    ...PAGES.map(({ slug }) => new URL(getGuidePath(slug), PUBLIC_URL).href),
    new URL('examples/', PUBLIC_URL).href,
    ...EXAMPLES.map(({ id }) => getExampleUrl(id).replace(SITE_ROOT, PUBLIC_URL)),
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
}

function readPageMarkdown(slug) {
  const file = slug === 'changelog' ? path.join(ROOT, 'CHANGELOG.md') : path.join(DOCS, 'guide', `${slug}.md`);
  return fs.readFileSync(file, 'utf8');
}
