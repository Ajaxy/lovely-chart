// The pages of the guide in the order of its sidebar, and the links of the site between them

// The root of the site, the folder above this module's. It is cut from the URL of the module at run time, as the dev
// server rewrites a `new URL()` of a literal path and `import.meta.url` into a path of its file system.
export const SITE_ROOT = import.meta.url.replace(/[^/]+\/[^/]*$/, '');

// Where the site is published, for the links that leave it: the canonical URL of a page, a page for an assistant to read
export const PUBLIC_URL = 'https://ajaxy.github.io/lovely-chart/';

export const REPOSITORY_URL = 'https://github.com/Ajaxy/lovely-chart';

export const SECTIONS = [
  {
    title: 'Getting started',
    pages: [
      ['introduction', 'Introduction'],
      ['installation', 'Installation'],
      ['getting-started', 'Your first chart'],
      ['frameworks', 'Using with frameworks'],
    ],
  },
  {
    title: 'Core concepts',
    pages: [
      ['data', 'Data format'],
      ['chart-types', 'Chart types'],
      ['axes', 'Axes and values'],
      ['dates', 'Dates, time zones and locales'],
    ],
  },
  {
    title: 'Features',
    pages: [
      ['tooltip', 'Tooltip'],
      ['legend', 'Legend'],
      ['minimap', 'Minimap and ranges'],
      ['zoom', 'Zoom and drill-down'],
      ['annotations', 'Annotations'],
      ['updating', 'Updating data and loading'],
      ['interaction', 'Events and external control'],
      ['accessibility', 'Accessibility'],
    ],
  },
  {
    title: 'Styling',
    pages: [
      ['theming', 'Theming and colours'],
      ['layout', 'Layout, sizing and fonts'],
      ['overlays', 'Overlays and custom marks'],
    ],
  },
  {
    title: 'Reference',
    pages: [
      ['api', 'API reference'],
      ['css', 'CSS variables and classes'],
      ['changelog', 'Changelog'],
    ],
  },
].map(({ title, pages }) => ({ title, pages: pages.map(([slug, pageTitle]) => ({ slug, title: pageTitle })) }));

export const PAGES = SECTIONS.flatMap(({ pages }) => pages);

export const DEFAULT_PAGE = PAGES[0].slug;

// The changelog of the package, which the build of the site copies next to it
export const CHANGELOG_URL = new URL('CHANGELOG.md', SITE_ROOT).href;
export const CHANGELOG_FALLBACK_URL = 'https://raw.githubusercontent.com/Ajaxy/lovely-chart/master/CHANGELOG.md';

/**
 * The URL of a page of the guide, `guide/` for the first and `guide/<slug>` for the others, each the static page
 * `guide/<slug>.html` that `scripts/site.js` builds, next to its Markdown, `guide/<slug>.md`
 */
export function getGuideUrl(slug, hash, root = SITE_ROOT) {
  const url = new URL(getGuidePath(slug), root);
  if (hash) {
    url.hash = hash;
  }
  return url.href;
}

export function getGuidePath(slug) {
  return slug === DEFAULT_PAGE ? 'guide/' : `guide/${slug}`;
}

/**
 * The page of the guide a URL of the site leads to, the first for `guide/` and `guide/index.html`, or `undefined` for
 * a URL out of the guide
 */
export function getGuideSlug(url) {
  const guidePath = new URL('guide/', SITE_ROOT).pathname;
  const { pathname } = new URL(url, SITE_ROOT);
  if (!pathname.startsWith(guidePath)) {
    return undefined;
  }
  const name = pathname.slice(guidePath.length).replace(/\.html$/, '');
  if (name.includes('/')) {
    return undefined;
  }
  return name === '' || name === 'index' ? DEFAULT_PAGE : name;
}

export function getExampleUrl(id) {
  const url = new URL('examples/', SITE_ROOT);
  if (id) {
    url.searchParams.set('id', id);
  }
  return url.href;
}

export function getPageMarkdownUrl(slug, root = SITE_ROOT) {
  return new URL(slug === 'changelog' ? 'CHANGELOG.md' : `guide/${slug}.md`, root).href;
}

export function getPageSourceUrl(slug) {
  return slug === 'changelog'
    ? `${REPOSITORY_URL}/blob/master/CHANGELOG.md`
    : `${REPOSITORY_URL}/blob/master/docs/guide/${slug}.md`;
}

export async function fetchPageMarkdown(slug) {
  const response = await fetch(getPageMarkdownUrl(slug));
  if (response.ok) {
    return response.text();
  }
  if (slug === 'changelog') {
    return (await fetch(CHANGELOG_FALLBACK_URL)).text();
  }
  throw new Error(`The page "${slug}" is missing`);
}

/**
 * Where a link of a guide page leads on the site: another page by its `.md` file, a file of the repository on GitHub
 */
export function resolveGuideLink(href) {
  if (/^(https?:|mailto:|#)/.test(href)) {
    return href;
  }
  const pageLink = href.match(/^(?:\.\/)?([\w-]+)\.md(#.*)?$/);
  if (pageLink) {
    const [, slug, hash] = pageLink;
    if (PAGES.some((page) => page.slug === slug)) {
      return getGuideUrl(slug, hash?.slice(1));
    }
  }
  const upLink = href.match(/^(?:\.\.\/)+(.*)$/);
  if (upLink && /\.(md|ts|js|json|scss)(#.*)?$/.test(upLink[1])) {
    return `${REPOSITORY_URL}/blob/master/${upLink[1].replace(/^docs\//, 'docs/')}`;
  }
  return href;
}
