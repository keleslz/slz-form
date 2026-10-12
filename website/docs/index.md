---
id: index
title: slz-form
sidebar_label: Overview
sidebar_position: 0
description: A framework-agnostic form engine, where the UI is driven by flags.
---

# slz-form

:::warning Pre-release
The packages are built and ready, **nothing is on npm yet**. The API may still
move.
:::

A form is rarely hard because of its values. It is hard because of everything
around them: a field locked while a request is in flight, another hidden until
a checkbox is ticked, an error that only shows after the user leaves the field
but never on a prefill, a button greyed out while the form is invalid or
submitting. That logic usually ends up scattered across the view, as booleans
recomputed by hand:

```tsx
<input disabled={loading || submitting || !brand || readOnly} />
{touched && error && <p>{error}</p>}
```

slz-form moves it into the engine. **What a field *is* is read as flags; what
it *contains* is read as data.** The component decides nothing — it reads a
state and renders:

```tsx
if (field.hasFlag("invisible")) return null;

<input disabled={field.hasFlag("locked")} readOnly={field.hasFlag("readonly")} />
{field.hasFlag("loading") && <Spinner />}
{field.hasFlag("error") && <p>{field.error}</p>}
```

Two functions read every state, at the field and at the form: `hasFlag(...)` is
the **AND** — all present; `hasAny(...)` is the **OR** — at least one. That is
the whole read surface, and it is what dissolves the
`loading || submitting || !brand` above.

```tsx
<button disabled={!form.hasFlag("valid", "idle")}>Submit</button>
```

## Where to start

| You want to… | Go to |
|---|---|
| see what it replaces | [The problem](getting-started/the-problem.md) |
| install it, run the demo | [Installation](getting-started/installation.md) |
| write your first form | [First form](getting-started/first-form.md) |
| understand the model before coding | [Flags, and the two functions](model/flags.md) |
| wire up a specific need | [Guides](guides/prefill.md) |
| the exact signature of a function | [API reference](reference/slz-form/index.md) |
| know **why** it is built this way | [The design notes](/conception/MODEL) |

## What it is not

- **Not a component library.** No styling, no design system, no imposed markup:
  the engine produces a state, the rendering stays yours. The demo's components
  are examples, not the API.
- **Not a schema validator.** It replaces neither Zod nor Yup and invents no
  rule language: it orchestrates the validators you write — and can wrap one.
- **Not a general-purpose state manager.** It manages the state of your forms,
  not of your application, and plugs into no store.
- **Not an HTTP layer.** It makes no network call; it orchestrates yours — when
  to fire them, what to lock meanwhile, what to do with the result.
- **Not a form generator.** No rendering from JSON, no declarative schema
  producing a page. You write your view.
- **No server rendering yet.** The React adapter reads its state via
  `useSyncExternalStore` without `getServerSnapshot`: server-side rendering
  throws.
- **Not an abstraction over React.** The core does not know React exists; the
  adapter is thin and replaceable, not a compatibility layer.
