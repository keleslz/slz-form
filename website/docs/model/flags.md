---
id: flags
title: Reading flags
sidebar_position: 1
description: Read loading, validity and interaction state on fields and forms.
---

# Reading flags

Use flags to decide whether to disable an input, show a spinner or display a validation error. This page explains the available flags, how they combine and how field state differs from form state.

A flag is a named state such as `loading` or `locked`. Values, options and messages remain data properties. `hasFlag` checks that all supplied flags are present; `hasAny` checks that at least one is present.

```ts
field.hasFlag("loading", "invisible")   // AND — all present
field.hasAny("locked", "readonly")      // OR  — at least one
```

For example, you can disable a submit button according to the form's flags:

```tsx
<button disabled={!form.hasFlag("valid", "idle")}>Submit</button>
```

## The vocabulary

A validator checks values and reports errors or warnings. A behavior reacts to field events and can update values, options or availability. The field controller stores those results and records interaction and lifecycle state.

| Flag | Meaning | Source |
|---|---|---|
| `pristine` · `valid` · `error` | one displayed validity state at a time; `pristine` until interaction | validator result, gated by the controller's `touched` state |
| `idle` · `loading` | one activity state at a time | behaviors and validator |
| `locked` · `readonly` · `invisible` | disabled input, read-only input, hidden field; can coexist | behaviors; controller also contributes locks and view-supplied read-only state |
| `required` · `touched` · `focused` · `mounted` · `submitting` | required field, user interaction, focus, active lifecycle, form submission | controller |
| your application's flags | additional states such as `skeleton` | behaviors through `ctx.state.mark(...)` |

A form also provides `hasFlag` and `hasAny`. Its flags are `valid` or `error`, its submission status (`idle`, `submitting` or `submitted`), and the aggregate flags `loading` and `touched`.

```ts
form.getSnapshot().hasFlag("valid", "idle");   // the submission can go
```

At the form level, `idle` describes submission status. It can coexist with `loading`, which means a mounted field or a row has pending work. `submit()` waits for the relevant work and checks validity before reporting success. It does not send the values to a server.

## How flags combine

A field has exactly one flag from each exclusive group: displayed validity and activity. It cannot carry both `pristine` and `error`, or both `idle` and `loading`.

The other flags are cumulative: every source contributes its flags, and the controller combines them. If loading model options and submitting the form both lock the model input, finishing the option request removes only that behavior's lock. The input stays locked until all sources have released it.

Within an exclusive group, setting a new state replaces the previous one. For a cumulative flag, removing it means that one source stops contributing it.

## Adding an application flag

A behavior can publish `mark("skeleton")` so your view can read `hasFlag("skeleton")`. This adds an application state without changing the engine. See [Your own flags](../guides/your-own-flags.md).

Reserved flags such as `error` cannot be set this way: `mark("error")` throws. Validity and activity use their own APIs. Availability flags such as `locked`, `readonly` and `invisible` are allowed.

## Reading state in components

Use `hasFlag` and `hasAny` for UI conditions. The field read API does not provide helpers such as `isLoading` or `showError`. If your application needs another named state, a custom flag lets it use the same read functions.

A snapshot is an object containing the current flags and data. It keeps the same reference until the controller's published state changes, so components can subscribe to it.

## Displaying errors and blocking submission

An untouched field stays `pristine` even after validation has found errors. A prefilled postcode can therefore have a blocking error without displaying an error message yet. `change`, `blur` and field submission mark it `touched`, allowing the displayed validity to become `valid` or `error`.

`field.errors` contains blocking messages regardless of interaction. Once validation has finished, a non-empty array means the field failed a check. While validation is pending, use `loading` as well: an empty array alone does not mean the new check has completed.

```ts
field.hasFlag("error")       // is there something to show the user?
field.errors.length > 0      // is this value refused?
```

The form uses blocking messages to calculate its validity, even before interaction. Mounted, visible fields contribute to that calculation; hidden fields do not block it. Lists also contribute their row errors. A prefilled invalid form can therefore be `error` while its individual fields remain `pristine`.
