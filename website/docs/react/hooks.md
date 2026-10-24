---
id: hooks
title: Hooks
sidebar_position: 2
description: useField, useForm and useFieldArray — what they take, what they return, and why no useState copies the engine's state.
---

# Hooks

| Export | Role |
|---|---|
| `hooksFor(form)` | returns `useField`, `useFieldArray` and `useForm`, bound to `form` and typed by its field map |
| `useField(params)` | one field: value, messages, flags, event handlers |
| `useForm()` | the whole form: flags, values, errors, `submit`, `reset` |
| `useFieldArray(name)` | the rows of a list: `rows`, `append`, `remove`, `move`, `clear` |
| `useFieldOn(form, params)` | `useField` for a form you pass in — used for the fields of a [row](./lists.md) |
| `useFieldArrayOn(form, name)` | `useFieldArray` for a form you pass in — a list nested in a row |
| `FormProvider` / `useFormRegister` | put a `FormRegister` (every form of the app) in context, and read it back |

## `useField`

```tsx
import { useField } from "./form/signup-form";

const field = useField({ name: "email", required: true, validator: new EmailValidator() });
```

**What it takes.** Two kinds of parameters, and the difference matters:

| Read once, when the field is created | Applied again whenever they change |
|---|---|
| `validator`, `behaviors`, `initialValue`, `requiredMessage`, `requiredTrue` | `required`, `locked`, `readOnly`, `options`, `value` |

So writing `useField({ name, behaviors: [...], validator: new X() })` inline in
a render is safe: a new instance is built on each render, but only the first
call's values are used and the field is never rebuilt. The flip side: changing
them later has no effect — a field's behaviors and validator are fixed for its
lifetime.

`value` makes the field **controlled** by the parent: when the `value` key is
present, the field follows it — `value: undefined` empties the field. Leave the
key out for a field the user drives.

**What it returns.**

| Member | What it is |
|---|---|
| `name` | the field's name |
| `value` | the current value |
| `hasFlag(...)` / `hasAny(...)` / `flags` | the field's [flags](../model/flags.md) |
| `ui` | the same flags as a `UiState` (`validity`, `activity`, `markers`) |
| `error` / `errors` / `warnings` / `issues` | the validator's messages — `issues` carries `severity` and `code` |
| `options` | the option list |
| `onChange(value)` / `onBlur()` / `onFocus()` | wire them to the input |
| `controller` | the underlying `FieldController`, for anything else |

```tsx
field.hasFlag("locked", "required")   // AND — all present
field.hasAny("loading", "invisible")  // OR  — at least one
```

To route a message somewhere else than under the field, filter `issues` on
`code`:

```tsx
const toasts = field.issues.filter((issue) => issue.code === "toast");
```

`readonly` and `locked` are different: `readonly` is readable and selectable
but not editable, and does not imply `locked`. The view can set either with
`useField({ name, locked, readOnly })`, on top of what behaviors set.

## `useForm`

```tsx
const { hasFlag, submit } = useForm();

<button disabled={hasFlag("submitting")} onClick={() => void submit()}>
    Submit
</button>
```

| Member | What it is |
|---|---|
| `hasFlag(...)` / `hasAny(...)` / `flags` | the form's flags: `valid` · `error`, `idle` · `submitting` · `submitted`, `loading`, `touched` |
| `values` | the payload, as in `form.values()` |
| `errors` | blocking messages, keyed by field name |
| `snapshot` | the whole `FormSnapshot`, including `snapshot.arrays` for lists |
| `submit()` | the [submission gate](../guides/submit.md) — `Promise<boolean>` |
| `reset()` | starts the form over |

:::note `error` does not mean the same thing on a field and on the form
On a field, `error` is what you **display** — off until the field is touched,
so a prefilled value lights nothing. On the form, `error` is what is **true**: a
prefilled, invalid form does not submit. To know whether one field's value is
refused, read its `errors`. See [Flags](../model/flags.md#displayed-versus-true).
:::

:::caution Two things to know about `useForm`
- The guard `!hasFlag("valid", "idle")` stays disabled after a successful
  submission until `reset()`: the form stays `submitted` until `reset()` or
  the next `submit()`, and this button is the one that would call it. See
  [Which guard for the button](../guides/submit.md#which-guard-for-the-button).
- A component calling `useForm()` calls `form.mount()` when it mounts, and that
  mounts **every** field created on the form so far — including a field whose
  component has since unmounted, which then comes back into `values()` and the
  verdict. This happens on every mount of that component — a conditional
  render, a route change, a new `key`. Keep the component that calls
  `useForm()` mounted for as long as the form is in use.
:::

## No `useState` copies the engine's state

`useField` only connects the component's lifecycle to the field and reads its
snapshot through `useSyncExternalStore`. A field that changes **does not
re-render the others**. Subscribing to the whole form with `useForm()` is an
explicit choice, for the components that need it: a submit button, a summary.

This is measured, not just claimed: the demo counts renders per field and
shows the difference with the same view written with `useState`.

## `FormProvider` and `useFormRegister`

For the common case you do not need them: `hooksFor(form)` already binds the
hooks to the form. They exist for app-wide tools — a debug panel listing every
form, for instance:

```tsx
import { FormRegister } from "slz-form";
import { FormProvider } from "slz-react-form";

const formRegister = new FormRegister({ values: [signupForm, invoiceForm] });

<FormProvider register={formRegister}><App /></FormProvider>
```

`useFormRegister()` returns that register: `names()`, `get(name)`,
`require(name)`, `snapshots()`, `listen(callback)`.

:::caution Known gap: the register is not typed by field map
`register.get(name)` and `register.require(name)` currently return a form
whose field map is lost, so `.field("email")` on it does not compile. This is a
typing bug, not a design choice. Until it is fixed, use
the register to list forms and read their snapshots, and import the form's own
module to work with its fields.
:::
