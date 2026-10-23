---
id: index
title: slz-form
sidebar_label: Overview
sidebar_position: 0
description: A TypeScript-first, framework-agnostic form engine where the UI is driven by flags.
---

# slz-form

:::warning Pre-release
The packages build and pass their tests, but **nothing is on npm yet**. The API
may still change.
:::

slz-form is a form engine written in TypeScript, with no framework inside. You
declare your fields, the reactions you attach to them and the rules that judge
them. The engine owns the values, the UI states and the links between fields.
Your components only read a state and render it.

## Why

A form is rarely hard because of its values. It is hard because of everything
around them: a field locked while a request runs, another hidden until a box is
ticked, an error that shows after the user leaves the field but never on a
prefilled value, a button greyed out while the form is invalid or sending.
That logic usually ends up in the view, as booleans recomputed by hand:

```tsx
<input disabled={loading || submitting || !brand || readOnly} />
{touched && error && <p>{error}</p>}
```

With slz-form, the field tells you what it **is** through flags, and what it
**contains** through data:

```tsx
if (field.hasFlag("invisible")) return null;

<input disabled={field.hasFlag("locked")} readOnly={field.hasFlag("readonly")} />
{field.hasFlag("loading") && <Spinner />}
{field.hasFlag("error") && <p>{field.error}</p>}
```

Two functions read every state, on a field and on a form: `hasFlag(...)` is an
**AND** (all the flags are present), `hasAny(...)` is an **OR** (at least one
is). There is nothing else to learn to read state.

## Vocabulary

The words below come back on every page.

| Word | What it means |
|---|---|
| **form** | a `FormController`: it creates the fields, gathers their values and gates the submission. |
| **field** | a `FieldController`: one input — its value, its interactions, its flags, its validity. |
| **field map** | the TypeScript type you give the form, `{ email: string; age: number }`. Field names and value types are checked against it. |
| **flag** | a word describing a state: `loading`, `locked`, `error`… You test it with `hasFlag` / `hasAny`. |
| **snapshot** | the immutable state of a field or form at one instant: its value, its flags, its messages. A new object only when something changed. |
| **behavior** | an object that **reacts**: it fills a value, loads options, locks or hides the field. It never decides validity. |
| **validator** | a class that **judges** a value and reports issues. It is the only source of validity. |
| **issue** | what a validator reports: a message, a severity (`error` blocks, `warning` does not) and an optional `code`. |
| **hook** | two meanings. A **behavior hook** is a function of a behavior the engine calls at a moment of the field's life: `onMount`, `onChange`, `onBlur`… A **React hook** is one of the adapter's functions: `useField`, `useForm`… |
| **`ctx`** | the object passed to your code. A behavior hook's `ctx` holds the behavior's own flags, read access to the form and other fields, and the methods that write **this** field. A validator's `ctx` is read-only: `watched(name)`, `form`, `signal`. |
| **`watch`** | the list of other fields a behavior or validator reads. Declaring it is what re-runs them when those fields change. |
| **mount** | putting a field into the form being filled. Only mounted fields count in the payload and the verdict. |
| **payload** | `form.values()`: what you send. |
| **verdict** | whether a value, or the whole form, is accepted. |
| **row** | one entry of a repeatable list. A row is a small form of its own. |

## Where to start

| You want to… | Go to |
|---|---|
| see what it replaces | [The problem](getting-started/the-problem.md) |
| install it, run the demo | [Installation](getting-started/installation.md) |
| write your first form | [First form](getting-started/first-form.md) |
| understand the model before coding | [Flags, and the two functions](model/flags.md) |
| send a form | [Submit a form](guides/submit.md) |
| use it without React | [Without a framework](guides/without-a-framework.md) |
| wire up a specific need | [Guides](guides/prefill.md) |
| the exact signature of a function | [API reference](reference/slz-form/index.md) |
| know **why** it is built this way | [The design notes](/conception/MODEL) |

## What it is not

- **Not a component library.** No styling, no markup: the engine produces a
  state, the rendering is yours. The demo's components are examples, not the
  API.
- **Not a schema validator.** It replaces neither Zod nor Yup and invents no
  rule language. It runs the validators you write — one of them can call a
  schema library.
- **Not a general state manager.** It holds the state of your forms, not of
  your application, and plugs into no store.
- **Not an HTTP layer.** It makes no network call. It decides when yours run,
  what is locked meanwhile, and what happens with the result.
- **Not a form generator.** No page rendered from JSON. You write your view.
- **No input masks.** Formatting what the user types — a phone number, a card
  number — is your input component's job.
- **No server rendering yet.** The React adapter reads its state with
  `useSyncExternalStore` without a `getServerSnapshot`, so server-side rendering
  throws.
- **Not a layer over React.** The core does not know React exists; the adapter
  is thin and replaceable.
