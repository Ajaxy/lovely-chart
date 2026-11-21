import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'vite';

// The demo page the e2e test drives, which the site leaves out: the dev server of `npm run dev` serves it at `/demo/`,
// with the library and the data of the site, as the test does
const DEMO_DIRECTORY = fileURLToPath(new URL('test/demo/', import.meta.url));
// The script that builds the pages of the guide, `llms.txt` and the other files the site makes of its sources
const SITE_SCRIPT_URL = new URL('scripts/site.js', import.meta.url).href;
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export default {
  plugins: [
    serveSite(),
    // The code of the examples, which their pages read as text
    serveAsIs('example-code', '/examples/code/', (root) => [path.join(root, 'examples/code')]),
    serveAsIs('demo', '/demo/', (root) => [DEMO_DIRECTORY, root]),
    minifyLibrary(),
  ],
  build: {
    // Emit native `#private` class members instead of WeakMap-based lowering
    // (default 'modules' target includes Safari 14, which lacks them).
    target: 'esnext',
    lib: {
      entry: 'src/index.ts',
      name: 'LovelyChart',
      formats: ['es'],
      fileName: () => 'LovelyChart.js',
      cssFileName: 'LovelyChart',
    },
    // `minifyLibrary()` minifies the code whole, as `minify` leaves the whitespace of an ES library. The stylesheet stays
    // as written, as a minifier rewrites the values of its custom properties, which a page reads as text.
    minify: false,
  },
};

/**
 * Minifies the code of the library, its whitespace too, which Vite keeps in an ES library for the pure annotations a
 * bundler shakes trees by: the chart is one class a page takes whole, and a page that loads the library from a CDN
 * loads the file the build writes, as it is
 */
function minifyLibrary() {
  return {
    name: 'lovely-chart:minify',
    apply: 'build',
    // In place of `renderChunk`, as Vite prints the chunk again after those hooks
    async generateBundle(options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') {
          continue;
        }
        const { code, errors } = await minify(chunk.fileName, chunk.code, { module: true });
        if (errors.length) {
          throw new Error(errors.map(({ message }) => message).join('\n'));
        }
        chunk.code = code;
      }
    },
  };
}

/**
 * Has the dev server build the pages of the guide and the other files `npm run demo` builds for the site on each request,
 * so they follow the Markdown as it changes
 */
function serveSite() {
  return {
    name: 'lovely-chart:site',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const { buildSiteFile } = await import(SITE_SCRIPT_URL);
          const file = buildSiteFile(decodeURIComponent(req.url.split('?')[0]));
          if (!file) {
            next();
            return;
          }
          res.setHeader('Content-Type', file.type);
          res.end(file.body);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

/**
 * Has the dev server serve the files under `urlPrefix` as they are, as GitHub Pages does, in place of the modules and
 * pages it makes of `.js`, `.css` and `.html` files: each from the first of the directories `getDirectories(root)`
 * returns that holds it, and the `index.html` of the first for `urlPrefix` itself
 */
function serveAsIs(name, urlPrefix, getDirectories) {
  return {
    name: `lovely-chart:${name}`,
    configureServer(server) {
      const directories = getDirectories(server.config.root).map((directory) => path.resolve(directory));
      server.middlewares.use((req, res, next) => {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        if (urlPath === urlPrefix.slice(0, -1)) {
          res.writeHead(301, { Location: urlPrefix });
          res.end();
          return;
        }
        if (!urlPath.startsWith(urlPrefix)) {
          next();
          return;
        }
        const relativePath = urlPath.slice(urlPrefix.length) || 'index.html';
        const file = directories
          .map((directory) => path.join(directory, relativePath))
          .find((candidate, i) => candidate.startsWith(directories[i] + path.sep) && fs.existsSync(candidate)
            && fs.statSync(candidate).isFile());
        if (!file) {
          next();
          return;
        }
        res.setHeader('Content-Type', CONTENT_TYPES[path.extname(file)] || 'application/octet-stream');
        res.end(fs.readFileSync(file));
      });
    },
  };
}
