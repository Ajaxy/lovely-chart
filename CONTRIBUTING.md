# Contributing

## Setup

```sh
npm install
npm run dev     # builds the library and serves the site at the printed URL
```

The site in `docs/` is what GitHub Pages publishes: the examples at `/examples/`, which `/` leads to, and the guide at `/guide/`. `npm run demo` builds the library and copies it and `CHANGELOG.md` next to the pages, then builds the files the site makes of its sources with `scripts/site.js`, as CI does before it publishes and `npm run dev` does first. The demo page the e2e test drives, `test/demo/`, is not published: `npm run dev` serves it at `/demo/`, with the library and the files of `docs/data` it loads.

## Checks

```sh
npm test
```

Runs the full suite: typecheck, ESLint, Stylelint, build and an end-to-end smoke test in the headless shell of Chromium. The e2e test runs in the version the locked `playwright-core` pins, as CI does; install it, and again after a bump of `playwright-core`, with:

```sh
npx playwright-core install --only-shell chromium
```

The e2e test runs its sections on 4 pages of the demo at once, each section a `section()` call that relies on no other, as a page may run it after any other; `E2E_WORKERS=1` runs them in turn on one page, to follow one in its log. A check waits for the page to go idle, with `waitForIdle(page, ms)` or, in the page, `window.idleTracker.wait(ms)`, at most `ms`; a fixed wait whose time itself matters, such as the gap of a double click, says why in an `eslint-disable` comment. `E2E_CHANNEL=chrome npm test` runs the e2e test in the installed Google Chrome instead, and `E2E_TIMINGS=1` lists the sections that took the longest, as CI does.

A pre-commit hook runs `eslint --fix` and `stylelint --fix` on staged files automatically.

## Documentation

The guide is Markdown in `docs/guide`, one file per page, which the site renders and GitHub shows as it is; `docs/site/pages.js` lists the pages in the order of the sidebar. The reference is `api.md` (the constructor, every chart option, the methods, the update options, the colours, the exports and the types) and `css.md` (the CSS variables and the stable classes). Each row of their tables is an entry with an anchor of its own, the name of its first cell: `api.md#withMinimap`, `api.md#datasets-color` for `datasets[*].color`, `api.md#update` for `update(newData, options?)`.

- A page has one `#` title and a lead paragraph, then `##` sections and `###` subsections, which the table of contents lists.
- A link to another page is a relative `.md` link, which works on the site and on GitHub: `[Tooltip](tooltip.md#notes)`.
- A fenced block of `js live` runs on the site above its code, in a page of its own whose body holds `<div id="chart"></div>`. It imports `lovely-chart`, and `./demo-data.js` for deterministic data (`days()`, `hours()`, `months()`, `series()`, `random()`), or fetches the files of `docs/data` as `../data/lines.json`. An `html live` block is the body of such a page, with a `<script type="module">` of its own.
- Alerts are GitHub's: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`.

`scripts/site.js` renders each page into `docs/guide/<slug>.html`, served at `/guide/<slug>` next to its Markdown at `/guide/<slug>.md`, so a reader, a crawler or an assistant without JavaScript gets the whole page, and the browser takes it over. It also writes `llms.txt`, the index of the pages and examples for language models, `llms-full.txt`, the whole guide in one file, and `sitemap.xml`. These are not committed; `npm run dev` builds them on each request, so they follow the Markdown, and a change to the code of `docs/site` that renders them takes a restart of the dev server. The key facts at the top of `llms.txt` are in `scripts/site.js`: keep them true as the API changes.

An example of the gallery is an entry of `docs/examples/examples.js` and its code in `docs/examples/code/<id>.js`, with `<id>.css` and `<id>.html` beside it when its `parts` name them. Its page runs as a live block does.

The gallery shows a preview image of each example in the day and the night skin, `docs/examples/thumbnails/<id>-day.webp` and `<id>-night.webp`. After a change to an example, or to the look of the charts, render them again and commit them:

```sh
npm run thumbnails
```

An example with no image yet runs live in its card, as do those with `isPreviewLive`, whose charts move by themselves, such as one that loads its data.

## Code style

See [CODESTYLE.md](CODESTYLE.md). Commit and PR titles follow the format described there:

```
[Tag] Component / Area: Imperative description
```

A bug fix title starts its description with `Fix`, followed by the problem as a user or developer sees it, for example `Minimap: Fix edge margin fade at bounds`.

## Pull requests

- Keep PRs focused on a single change.
- For a fix, say in the description how the code now avoids the problem.
- Link an issue with `Closes #<issue_number>` in the description.
- `npm test` must pass.
- Update the reference in `docs/guide` (`api.md` or `css.md`), the guide of the feature and `CHANGELOG.md` when the public API changes.
