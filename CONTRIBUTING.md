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

Runs the full suite: typecheck, ESLint, Stylelint, build and an end-to-end smoke test in headless Chrome. The e2e test requires Google Chrome, or a Playwright Chromium as fallback (`npx playwright install chromium`).

A pre-commit hook runs `eslint --fix` and `stylelint --fix` on staged files automatically.

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
- Update `README.md` and `CHANGELOG.md` when the public API changes.
