---
id: installation
title: Installation
sidebar_position: 2
description: Install the packages, or run the demo from the repository.
---

# Installation

**Requirements:** Node.js ≥ 20.19, npm. TypeScript with `strict: true` — the
narrowing of field names and values depends on it.

## In your application

```bash
npm install slz-form slz-react-form
```

:::warning Pre-release
Nothing is on npm yet. The names `slz-form`, `slz-react-form`,
`slz-angular-form` and `slz-vue-form` are available, and the API may still
move.
:::

The engine alone is enough if you do not use React:

```bash
npm install slz-form
```

`slz-form` has **zero runtime dependencies** and ships **ESM** only — no
CommonJS build.

### A single copy of each

`slz-form` and `react` are **peer dependencies** of the React adapter: your
application must resolve a single copy of each.

Two copies of React break hooks. Two copies of `slz-form` break the engine's
`instanceof BehaviorState` check — flags are then **silently** ignored, which
is far worse than an error. If a behavior seems to have no effect, check this
first.

## From the repository

```bash
git clone https://github.com/keleslz/slz-form.git
cd slz-form
npm install     # npm workspaces: everything is linked locally
npm run dev     # opens the React demo
```

The demo mounts **every field type in a single view** — text, email, textarea,
number, select, dependent select, multi-select, radio, checkbox, file, date,
time, datetime, conditional field, prefilled field. One tab shows the
implementation with the engine, the other the same view written with
`useState`, and a per-field render counter makes the gap visible.

In development, the demo points at the packages' **sources**: editing the
engine hot-reloads the demo, with no rebuild.

### The checks

```bash
npm run typecheck      # all 3 workspaces
npm run lint
npm test               # engine unit tests
npm run test:e2e       # the demo in a real browser
npm run build          # packages (tsup) then demo (vite)
```

CI replays all of this on every PR, plus the content actually published
(`npm pack --dry-run`).

## The documentation site

It lives in `website/`, **outside** the npm workspaces: Docusaurus pulls in a
lot of dependencies, and the engine's CI jobs should not have to pay for them.

```bash
npm install            # at the root first: TypeDoc reads the sources through this path
cd website
npm install
npm start
```
