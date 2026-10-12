---
id: installation
title: Installation
sidebar_position: 2
description: Set up the packages in an application or run the demo from the repository.
---

# Installation

This page covers application setup, running the React demo and starting the documentation site. You will also find the commands used to check the repository.

You need Node.js ≥ 20.19 and npm. Enable `strict: true` in TypeScript so field names and values are checked with the intended types.

## In your application

The application installation command is:

```bash
npm install slz-form slz-react-form
```

:::warning Pre-release
The API may still change. To try the current code during development, follow the repository instructions below. The installation commands use the package names `slz-form` and `slz-react-form`; availability on npm depends on publication. The names `slz-angular-form` and `slz-vue-form` do not mean those adapters are included in this repository.
:::

If you use the core without React, you only need:

```bash
npm install slz-form
```

`slz-form` has no runtime dependencies. It ships ESM, with no CommonJS build.

### A single copy of each

The React adapter declares `slz-form` and React ≥ 18 as peer dependencies: your application supplies them. Make sure it resolves a single copy of each.

Multiple copies of React can break hooks. The engine also checks behavior results with `instanceof BehaviorState`. `BehaviorState` is the object a behavior returns to describe its loading state and flags. A result created by another copy of `slz-form` fails that check and can be ignored without an error. Check dependency resolution if a behavior appears to have no effect.

## From the repository

```bash
git clone https://github.com/keleslz/slz-form.git
cd slz-form
npm install     # npm workspaces: everything is linked locally
npm run dev     # opens the React demo
```

npm workspaces link the packages locally. The demo includes text, email, textarea, number, select, dependent select, multi-select, radio, checkbox, file, date, time, datetime, conditional and prefilled fields in one view.

One tab uses the engine; another implements the same view with `useState`. A counter beside each field shows how often it renders. In development, the demo imports the package sources, so engine edits appear through hot reload without rebuilding the packages.

### The checks

```bash
npm run typecheck      # all 3 workspaces
npm run lint
npm test               # engine unit tests
npm run test:e2e       # the demo in a real browser
npm run build          # packages (tsup) then demo (vite)
```

CI runs these checks on pull requests. It also checks the package contents with `npm pack --dry-run`.

## The documentation site

The Docusaurus site lives in `website/`, outside the npm workspaces. Its dependencies are installed separately, so package checks do not require installing the site.

Install the root dependencies first: TypeDoc needs them to resolve imports while generating the API reference from the sources.

```bash
npm install            # at the root first: TypeDoc reads the sources through this path
cd website
npm install
npm start
```
