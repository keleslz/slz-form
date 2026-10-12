---
id: hooks
title: Hooks
sidebar_position: 2
description: Read field and form state through React subscriptions.
---

# Hooks

This page explains which React hook to use for a field, a form or a list. You will learn how to read flags and messages and keep subscriptions scoped to the state a component needs.

A field controller manages one field; a form controller manages its fields and lists. A snapshot is an object describing the current state. The hooks read snapshots through `useSyncExternalStore` and connect field and list mounting to React effects.

`useField`, `useForm` and `useFieldArray` below are the hooks returned by `hooksFor(form)`. `useFieldOn` and `useFieldArrayOn` are direct exports for supplying a controller yourself.

| API | Role |
|---|---|
| `hooksFor(form)` | creates `useField`, `useFieldArray` and `useForm` bound to a form and typed from its field map |
| `useField` | subscribes to a field; returns value, issues, flags and interaction handlers |
| `useForm` | subscribes to the whole form; returns `snapshot`, `values`, `errors`, flags, `submit` and `reset` |
| `useFieldArray` | subscribes to row composition; returns `rows`, `append`, `remove`, `move` and `clear` |
| `useFieldOn(form, params)` | connects a field to the supplied form, including a row's form |
| `useFieldArrayOn(form, name)` | connects a list to the supplied form, including a nested list |
| `FormProvider` | makes a `FormRegister` available through React context |
| `useFormRegister` | retrieves that register |

The field map associates names with value types. `FormRegister` stores named form controllers for components that need access to several forms. Hooks bound with `hooksFor` do not require its provider.

## Reading flags

A flag is a named state such as `locked` or `loading`. `hasFlag` requires every supplied flag; `hasAny` requires at least one:

```tsx
field.hasFlag("locked", "required")   // AND — all present
field.hasAny("loading", "invisible")  // OR  — at least one
```

`useForm` provides the same functions for form flags:

```tsx
const { hasFlag, submit } = useForm();

<button disabled={!hasFlag("valid", "idle")} onClick={() => void submit()}>
    Submit
</button>
```

`valid` means the form has no blocking errors. At the form level, `idle` describes submission status and can coexist with `loading`. `submit()` validates and waits for relevant pending work before returning a boolean; your application handles sending the values. See [Reading flags](../model/flags.md) for the vocabulary and combination rules.

:::note Error display after interaction
A validator checks values and reports errors or warnings. The field's `error` flag is gated by interaction: an untouched prefilled field stays `pristine`, even when validation has found errors. `field.errors` contains the blocking messages regardless of interaction. The form uses those messages to calculate validity, so an invalid prefilled form can block submission before showing field errors.
:::

## Choosing where to display messages

An issue is a validation message with a `severity` and optional `code`. Read `field.issues` to choose which messages belong under an input, in a toast or elsewhere:

```tsx
const toasts = field.issues.filter((issue) => issue.code === "toast");
```

Warnings are non-blocking and also appear in `field.warnings`. The engine supplies the messages; your view chooses the presentation.

## Input availability

Use `locked` to drive an input's disabled state and `readonly` for read-only presentation that can still allow reading and selecting its text. `readonly` does not imply `locked`.

The view can supply both with `useField({ name, locked, readOnly })`. A behavior, which reacts to field events and can update availability, can also contribute those flags. Removing the view's lock does not remove a behavior's lock. Match the flags to HTML attributes supported by your input.

## Subscription scope and renders

`useField` subscribes to the field's snapshot without copying it into `useState`. An unrelated field change does not notify that subscription. Fields watching each other can update through those dependencies, and a React parent render can still render its children.

Use `useForm` for a submit button or summary that needs form-wide state. A component using it receives updates when the whole-form snapshot changes. Keeping that subscription out of ordinary field components avoids unnecessary updates from unrelated inputs.

The demo's per-field counters let you inspect the renders for the engine version and the same view implemented with `useState`.
