# Contributing

## Setup

```sh
npm install
npm run dev     # builds the library and serves the demo page at the printed URL
```

## Checks

```sh
npm test
```

Runs the full suite: typecheck, lint, build and an end-to-end smoke test in headless Chrome. The e2e test requires Google Chrome, or a Playwright Chromium as fallback (`npx playwright install chromium`).

A pre-commit hook runs `eslint --fix` on staged files automatically.

## Code style

See [CODESTYLE.md](CODESTYLE.md). Commit messages follow the format described there:

```
[Tag] Component / Area: Imperative description
```

## Pull requests

- Keep PRs focused on a single change.
- `npm test` must pass.
- Update `README.md` and `CHANGELOG.md` when the public API changes.
