---
id: index
title: slz-form
sidebar_label: Overview
sidebar_position: 0
description: Manage field values, validation and loading state independently of your UI.
---

# slz-form

slz-form manages field values, validation and asynchronous work for your forms. This overview explains how your components read that state and points you to a working example.

:::warning Pre-release
The API may still change. Use the [repository setup](getting-started/installation.md#from-the-repository) to try the packages and the demo during development.
:::

In a car form, the model select needs new options when the brand changes. You also need to disable it while those options load, show errors after interaction and check the form before submission. When each component manages these rules, you often end up repeating conditions like these:

```tsx
<input disabled={loading || submitting || !brand || readOnly} />
{touched && error && <p>{error}</p>}
```

slz-form keeps this state in field controllers. A controller is the object that stores a field's value, handles interactions and runs its configured rules. A flag is a named state, such as `loading` or `locked`, that your component can check to choose what to render. Values, options and error messages are available separately.

```tsx
if (field.hasFlag("invisible")) return null;

<input disabled={field.hasFlag("locked")} readOnly={field.hasFlag("readonly")} />
{field.hasFlag("loading") && <Spinner />}
{field.hasFlag("error") && <p>{field.error}</p>}
```

A behavior is a function or object that reacts to field events, for example by fetching models when the brand changes. A validator checks a value and reports errors or warnings. You configure them on the controller; your component uses the resulting flags and data to render an input.

`hasFlag(...)` returns `true` when all the supplied flags are present. `hasAny(...)` returns `true` when at least one is present. Both fields and forms provide these functions.

```tsx
<button disabled={!form.hasFlag("valid", "idle")}>Submit</button>
```

Here, `valid` means the form has no blocking errors, and `idle` means it is outside a submission and has not reached `submitted`. A form can be `idle` while a field is `loading`; `submit()` waits for the relevant work and validates before returning its result. It does not send an HTTP request for you.

## Where to start

| You want to… | Go to |
|---|---|
| understand the component code this replaces | [The problem](getting-started/the-problem.md) |
| set up the packages or run the demo | [Installation](getting-started/installation.md) |
| create your first form | [First form](getting-started/first-form.md) |
| read field and form state | [Flags](model/flags.md) |
| prefill a field from an API | [Prefill a field](guides/prefill.md) |
| look up a function signature | [API reference](reference/slz-form/index.md) |
| read the design decisions | [Design notes](/conception/MODEL) |

## What you provide

- Your components, markup and styles. The demo components show one way to render the state; the packages do not supply a design system or generate a page from JSON.
- Your validation rules. You can write validators directly or call a schema validator such as Zod or Yup from one.
- Your network calls. Behaviors control when your functions run and can publish a loading or locked state while they wait.
- Your application state outside forms. The engine manages forms without requiring a global application store.
- Your framework integration. The core has no React dependency. The React adapter connects controllers to hooks, and another adapter can use the same form logic.

The React adapter currently supports client rendering only. Its hooks call `useSyncExternalStore` without `getServerSnapshot`, so server rendering throws. See [Wiring up React](react/installation.md).
