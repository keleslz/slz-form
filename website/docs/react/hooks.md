---
id: hooks
title: Hooks
sidebar_position: 2
description: useField, useForm, and why no useState copies the engine's state.
---

# Hooks

| Export | Role |
|---|---|
| `hooksFor(form)` | returns `useField`, `useFieldArray` and `useForm` bound to a form, typed by its field map |
| `useField` | a field: value, issues, flags, handlers |
| `useForm` | the whole form: `snapshot`, `values`, `errors`, flags, `submit`, `reset` |
| `useFieldArray` | the rows of a list: `rows`, `append`, `remove`, `move`, `clear` |
| `useFieldOn(form, params)` | `useField` bound to a given form — used to wire a row field |
| `useFieldArrayOn(form, name)` | `useFieldArray` bound to a given form — a list nested in a row |
| `FormProvider` | publishes the `FormRegister` in the tree, for cross-cutting access |
| `useFormRegister` | direct access to the register |

## Reading state: two functions

```tsx
field.hasFlag("locked", "required")   // AND — all present
field.hasAny("loading", "invisible")  // OR  — at least one
```

The form answers the same two functions, with the same words:

```tsx
const { hasFlag, submit } = useForm();

<button disabled={!hasFlag("valid", "idle")} onClick={() => void submit()}>
    Submit
</button>
```

The words themselves — `valid`, `idle`, `locked`, `loading`… —, their nature and
who emits them: [Flags](../model/flags.md).

:::note `error` at the field and at the form do not say the same thing
At the field, `error` is what you **display** — off until the field is touched,
so that a prefill lights nothing. At the form, `error` is what is **true**: a
prefilled, invalid form does not submit. The verdict of a field taken in
isolation is a non-empty `field.errors`.
:::

## Routing messages

`field.issues` carries each issue with its `severity` and its `code`, which lets
you route without the engine getting involved:

```tsx
const toasts = field.issues.filter((issue) => issue.code === "toast");
```

## `locked` and `readonly` are distinct

`readonly` is readable and selectable, but not modifiable — and does not imply
`locked`. The view can drive both:
`useField({ name, locked, readOnly })`.

## No `useState` copies the engine's state

`useField` only wires the React lifecycle onto the controller and reads its
snapshot via `useSyncExternalStore`. A field that changes **does not re-render
the others** — subscribing to the whole form is an explicit choice, reserved for
what needs it: a submit button, a summary.

This is measured, not asserted: the demo counts renders per field and shows the
gap with the same view written with `useState`.
