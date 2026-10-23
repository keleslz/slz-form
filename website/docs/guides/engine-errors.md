---
id: engine-errors
title: Engine errors
sidebar_position: 7
description: Where an error thrown by your behavior or validator code goes — form.engineErrors, hook-error and guard-violation.
---

# Engine errors

When **your code** throws inside the engine — a behavior hook rejects, a
validation rule crashes, an engine guard is violated — nobody is there to catch
it: the promise that carries it is awaited by no one. The engine catches it,
keeps the form working, and records it on the form. It **never logs to the
console**.

You read those records when you have a reason to — after a refused submission,
in a debug panel, in a test:

```ts
if (!(await form.submit())) {
    for (const err of form.engineErrors) {
        reportToSentry(err);
    }
}
```

:::caution The ready-made helpers handle their own failures
`prefill`, `lookup`, `loadOptions` and `suggest` catch the failure of their
`fetch` themselves, so **nothing** reaches `engineErrors`:

- `prefill` and `lookup` leave the value unchanged and return to `idle`;
- `loadOptions` and `suggest` publish an empty option list; `loadOptions` also
  calls its `onError` option, if you gave one.

To know about those failures, catch inside your `fetch`, or use `onError`:

```ts
const { loadOptions } = behaviorsFor(form);

const modelOptions = loadOptions({
    field: "model",
    watch: ["brand"],
    fetch: ({ brand }) => fetchModels(brand),
    onError: (error) => reportToSentry(error),
});
```

What `engineErrors` records is what **your own** behavior hooks and validators
throw or reject.
:::

:::warning This is not how you read validation errors
A value refused by a rule is not an engine error: read it with
`field.snapshot.errors`, `field.snapshot.issues` or `field.hasFlag("error")`.
`engineErrors` only contains what **threw**.
:::

## What a record contains

| Property | What it says |
|---|---|
| `scope` | where it happened: `"behavior"` or `"validator"` |
| `kind` | `"hook-error"` (your code threw) or `"guard-violation"` (an engine guard was violated) |
| `field` | the field it happened on |
| `rule` | the class name of the rule that failed (`constructor.name`) — validator records only. A minifier may rename classes in a production build |
| `error` | the thrown value, untouched |
| `at` | when it was recorded (`Date.now()`) |

## Your code, or the way the API was used?

`kind` tells you where to look:

- **`hook-error`**: **your** code threw — a network failure, an unreadable
  response, a bug;
- **`guard-violation`**: the **engine** refused something — for example a
  behavior calling `mark("error")` with a word the engine reserves.

```ts
const misuses = form.engineErrors.filter((err) => err.kind === "guard-violation");
```

An engine refusal is an `EngineGuardError`, which is exported:
`err.error instanceof EngineGuardError` gives the same answer as `kind`.

:::caution Current classification
Reading a field with `ctx.watched()` without declaring it in `watch` is an API
misuse, but today it is recorded as a `hook-error` — except inside an array of
validators, where it is a `guard-violation`. And a validation rule that throws
**synchronously** is recorded with `scope: "behavior"` and no `rule` (see
[An interrupted pass](../model/interrupted-pass.md)). Do not rely on `kind` or
`scope` alone to find these.
:::

## A rule that crashes

```ts
class Available extends IValidator<string> {
    protected async validate(value: string, report: ValidationReport) {
        const taken = await api.isTaken(value);   // the network fails here
        report.errorIf(taken, "Already taken");
    }
}
```

Two things happen, in two places:

- the field gets a blocking `"unverified"` issue — see
  [An interrupted pass is not a verdict](../model/interrupted-pass.md);
- `form.engineErrors` gets a record with `scope: "validator"` and
  `rule: "Available"`.

The first stops the form from being sent; the second tells you **why**. In an
array of validators, a member that crashes does not erase the issues of the
others: a refusal from a healthy rule is kept.

## A buffer you read, not an event

`engineErrors` is a property, not a subscription — there is no
`onEngineError`. An engine error is a crash the engine already recovered from:
a diagnostic record, not something to react to live.

- It is **outside the snapshot**: a new record does not notify `form.listen`
  and re-renders nothing. It exists on the form only, never on a field.
- It keeps the **50 most recent** records.
- `form.reset()` empties it; submitting does not, so an error raised during a
  submission is still there afterwards.
- Each read returns a **copy**, from oldest to newest.

:::note A validator used outside a form stays silent
`validator.handle(value)` called by hand, with no form around it, has nowhere
to record a failure: nothing is recorded anywhere.
:::
