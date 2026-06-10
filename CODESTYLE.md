# Code Style Guide

This project follows the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) as its baseline. The rules below extend and override it where necessary. Most of them are enforced by ESLint (`npm run lint`).

## Naming

- **Functions and methods** start with an imperative verb: `showMessage()`, `updateUser()`. Exception: `callback`.
- **Acronyms** follow standard camelCase rules (no all-caps): `parseJson`, `jsonToYaml`, `isUiReady`.
- **Boolean variables and parameters** start with a modal verb: `is*`, `has*`, `are*` (for plurals), `should*`, `can*`, `will*`. Exception: the argument `force`.
- **Optional boolean arguments** default to `false` — for an inverted flag, name it `noCaption` rather than passing `withCaption: false`.
- **Allowed abbreviations**: `e` (event handler argument), `err` (`catch` block argument), `cb` (callback). Single-letter element names are fine in one-line collection lambdas: `users.map((u) => u.name)`. Avoid all other abbreviations.
- Exception: the public config keys `withMinimap` and `withGradient` keep their names for compatibility.

## Constants

Static constants must not appear inside function bodies. Hoist them to the top of the module with a descriptive `UPPER_SNAKE_CASE` name:

```ts
const ZOOM_OUT_BIND_DELAY = 500;
```

## Functions

- Prefer function declarations over function expressions, except when an arrow function is needed to bind `this`.
- Order functions top-down by call hierarchy: high-level functions at the top, low-level helpers at the bottom (enforced via `@typescript-eslint/no-use-before-define` with `{ functions: false }`).
- If a pure function is called more than once within the same scope, store its result in a variable.
- If a function should not run when an argument is absent, declare that argument as **required** and check for its presence at the **call site**, not inside the function.

## Control Flow

Prefer early returns (guard clauses) over large or deeply nested conditional blocks.

## Comments

- Comments start with a capital letter.
- Single-sentence comments have no trailing period; multi-sentence comments end each sentence with a period.
- Code entities referenced in comments are wrapped in backticks.
- Comments are **direct assertions about current behavior** — no bug history, change history, or contrast with a previous state. Git history is the record of what changed; comments explain what *is*.
- A comment must state a **non-obvious constraint** the code cannot express. If the code is self-evident, omit the comment — even a "why" rationale is redundant when the reasoning is apparent from the code itself.

## Dead Code

Do not keep unused code, "just in case" code, or speculative utilities. If an object is not used outside its own module, it must not be exported.

## TypeScript

When a variable is guaranteed to exist at runtime but TypeScript cannot infer that, use the non-null assertion operator `!` instead of a conditional check:

```ts
func(a!);          // Correct
if (a) func(a);    // Incorrect — do not guard when the value is guaranteed
```

`null` is banned (`no-null/no-null`); use `undefined`, or the named sentinels `GAP` and `NO_FOCUS` where `null`/clear-semantics are part of a contract.

## Commit Messages

```
[Tag] Component / Area: Imperative description
```

- **Tag** (optional): `[Refactoring]`, `[Perf]`, `[Size]`, `[Dev]`, `[CI]`, `[Security]`.
- **Component or domain area** — capitalized, followed by a colon and an imperative-mood description starting with a capital letter.
- Use backticks when referencing programmatic names; separate multiple tasks with a semicolon; no trailing period.

Examples:

```
Minimap: Fix edge margin fade at bounds
[Refactoring] Tooltip: Extract balloon positioning
```
