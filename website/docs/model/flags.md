---
id: flags
title: Flags, and the two functions
sidebar_position: 1
description: Every state of a field or a form is a flag, read with hasFlag (AND) and hasAny (OR). The full vocabulary, and who sets each word.
---

# Flags, and the two functions

A **flag** is a word that describes a state: `loading`, `locked`, `error`,
`touched`… What a field **is** is read as flags. What it **contains** — its
value, its options, its messages — is read as data.

To read flags, there are two functions, and nothing else:

```ts
field.hasFlag("loading", "invisible")   // AND — every flag is present
field.hasAny("locked", "readonly")      // OR  — at least one is present
```

That replaces the `disabled={loading || submitting || !brand}` written by hand
in every field:

```tsx
<input disabled={field.hasFlag("locked")} readOnly={field.hasFlag("readonly")} />
```

The same two functions exist on a field (`FieldController`, its snapshot, and
`useField()`), and on a form (its snapshot, and `useForm()`).

## The flags of a field

| Flag | Group | Set by | Meaning |
|---|---|---|---|
| `pristine` · `valid` · `error` | **one at a time** | the validator, alone | the validity to **display**: `pristine` until the field is touched |
| `idle` · `loading` | **one at a time** | behaviors and the validator | `loading` while some asynchronous work runs on the field |
| `locked` | cumulative | behaviors, the engine, the view | show it greyed out, not editable |
| `readonly` | cumulative | behaviors, the view | show it readable and selectable, not editable |
| `invisible` | cumulative | behaviors | do not render it — see the note below |
| `required` | cumulative | the engine (from `required: true`) | the field is mandatory |
| `touched` | cumulative | the engine | the user changed or left the field, or `submit()` touched it |
| `focused` | cumulative | the engine | the field has focus |
| `mounted` | cumulative | the engine | the field is part of the form being filled |
| `submitting` | cumulative | the engine | the form is being submitted; comes with `locked` |
| *your own words* | cumulative | behaviors — `ctx.state.mark("skeleton")` | see [Your own flags](../guides/your-own-flags.md) |

:::caution `locked` and `readonly` are display flags
The engine does not refuse a write on a locked or read-only field:
`field.change()` goes through, even during `submit()`. Your input must honour
the flags — `disabled={field.hasFlag("locked")}`,
`readOnly={field.hasFlag("readonly")}`.
:::

"The view" means your component: `useField({ locked, readOnly })`, or
`field.update({ locked, readOnly })` in plain code.

:::note An invisible field is still sent
`invisible` takes the field out of the **verdict**: a hidden required field
does not block the form. It does **not** take it out of the **payload**: while
the field is mounted, `form.values()` still contains its value. To leave a
field out of what you send, unmount it (in React, stop rendering its
component).
:::

## The flags of a form

A form uses the same words, with one difference explained below.

| Flag | Group | Meaning |
|---|---|---|
| `valid` · `error` | one at a time | the **verdict**: no mounted, visible field and no row of a list has a blocking issue — or one does |
| `idle` · `submitting` · `submitted` | one at a time | where the submission stands |
| `loading` | cumulative | a mounted field, or a row, has work in flight |
| `touched` | cumulative | at least one field has been touched |

```ts
form.snapshot.hasFlag("valid", "idle")   // nothing blocks, and the form is neither submitting nor already submitted
```

:::caution `submitted` stays until `reset()` or the next `submit()`
After a successful `submit()`, the form moves to `submitted` and **stays
there** — editing a field afterwards does not bring it back to `idle`. Only
`form.reset()` or the next `submit()` changes it. So a button guarded by
`!hasFlag("valid", "idle")` — the button that would call `submit()` — stays
disabled after the first successful send, unless you reset the form. Pick the
guard that fits your flow in [Submit a form](../guides/submit.md#which-guard-for-the-button).
:::

The form's vocabulary is **closed**: your own flags live on fields, and
`form.snapshot.hasFlag("skeleton")` (or `useForm().hasFlag("skeleton")`) does
not compile. To show a form-wide state of your own, set the flag on a field
and read that field.

## Two kinds of groups

A plain set of flags would allow impossible states — `pristine` **and** `error`
at the same time. So the flags come in two kinds:

- **one at a time** (exclusive): `pristine` · `valid` · `error`, and `idle` ·
  `loading`. Setting one replaces the other, and the list of words is fixed.
- **cumulative**: every other flag. They add up, and a missing flag means its
  default. If three behaviors speak at once, a single `lock()` is enough to lock
  the field.

That also gives "removing a flag" a precise meaning: in an exclusive group you
**replace** the word; for a cumulative flag you **stop setting it**.

## Your own words

A behavior can publish a word the engine does not know — `mark("skeleton")` —
and the view reads it with `hasFlag("skeleton")`. The engine carries it without
having to learn it. See [Your own flags](../guides/your-own-flags.md).

The engine's own words are **refused** on that path: `mark("error")` throws.
Otherwise a behavior could publish the impossible state the groups exist to
prevent.

## No `isX` booleans

There is no `isVisible`, no `isLoading`, no `showError`. If you need an `isX`,
the flag you need is missing or badly named — it is not an accessor to add.

The reason is practical: an earlier version shipped the flag API *and* seven
derived booleans in the same change. Everyone used the booleans, and the flags
were never read.

## Displayed versus true

This is the one distinction to keep in mind:

- on a **field**, `error` is what you **display**. It stays off until the field
  is touched, so a prefilled value never lights an error on its own;
- on a **form**, `error` is what is **true**: a form prefilled with an invalid
  value does not submit, even though no field shows an error yet.

To know whether a single field's value is refused, regardless of display, read
its `errors`:

```ts
field.hasFlag("error")              // is there something to show the user?
field.snapshot.errors.length > 0    // is this value refused?
```

`form.submit()` touches every mounted field, so after a refused submission the
errors are displayed where they belong.
