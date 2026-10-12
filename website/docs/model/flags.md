---
id: flags
title: Flags, and the two functions
sidebar_position: 1
description: Two natures of flags, two read functions, and no state booleans.
---

# Flags, and the two functions

What a field **is** is read as flags; what it **contains** — value, options,
messages — is read as data. For state, two functions, and nothing else:

```ts
field.hasFlag("loading", "invisible")   // AND — all present
field.hasAny("locked", "readonly")      // OR  — at least one
```

That is what deletes the `disabled={loading || submitting || !brand}` recomposed
by hand in every field. The submit button fits in one call:

```tsx
<button disabled={!form.hasFlag("valid", "idle")}>Submit</button>
```

## The vocabulary

| Flag | Nature | Emitted by |
|---|---|---|
| `pristine` · `valid` · `error` | **mutually exclusive** | the Validator, alone |
| `idle` · `loading` | **mutually exclusive** | Behaviors + Validator |
| `locked` · `readonly` · `invisible` | cumulative | Behaviors + Controller + view |
| `required` · `touched` · `focused` · `mounted` · `submitting` | cumulative | the Controller |
| *your application's* | cumulative | Behaviors — `ctx.state.mark("skeleton")` |

The form answers the same two functions, with the same words: `valid` ·
`error` (the verdict), `idle` · `submitting` · `submitted`, `loading`, `touched`.

```ts
form.getSnapshot().hasFlag("valid", "idle");   // the submission can go
```

## Two natures, one rule per nature

A flat union would produce impossible states — `pristine` **and** `error` at
once. The first two groups are therefore **exclusive**, with a closed
vocabulary: writing a value there replaces another.

All the others are **cumulative**, and absence means default. A single `lock()`
locks, even if three behaviors speak at the same time. That is what gives
removing a flag a precise meaning: you **replace** within an exclusive group,
you **stop emitting** elsewhere.

## The vocabulary extends without touching the engine

A behavior publishes `mark("skeleton")`, the view reads `hasFlag("skeleton")`,
and the engine never had to learn the word. See
[Your own flags](../guides/your-own-flags.md).

The engine's own words, however, are **refused** on that path — otherwise you
would republish the impossible state just ruled out. `mark("error")` throws.

## No state booleans in the read surface

No `isVisible`, no `isLoading`, no `showError`. A need for `isX` never signals
a missing accessor: it signals **a missing flag, or a badly chosen word**.

The reason is empirical. An earlier version shipped the flag API *and* its
seven derived booleans in the same diff: the escape hatch became the norm, and
the flag API died in use.

## Displayed versus true

One structural nuance, and the source of nearly every confusion:

- at the **field**, `error` is what you **display**, and it stays off until the
  field is touched — a prefill lights nothing;
- at the **form**, `error` is what is **true**: a prefilled, invalid form does
  not submit.

The verdict of a field taken in isolation, regardless of display, is a
non-empty `errors`.

```ts
field.hasFlag("error")       // is there something to show the user?
field.errors.length > 0      // is this value refused?
```
