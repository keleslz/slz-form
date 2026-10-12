---
id: engine-errors
title: Engine errors
sidebar_position: 6
description: Inspect exceptions captured during behaviors and validation.
---

# Engine errors

This page shows how to inspect failures captured while the engine runs behaviors and validation. You will be able to send those diagnostics to your error reporting tool and distinguish them from validation messages.

A behavior reacts to field events; a validator checks values and reports issues. An issue is a validation message with severity `error` or `warning`. If running a hook or rule throws or rejects without being handled by your code, the engine's catch paths record the exception on the form instead of logging it to the console.

```ts
if (!(await form.submit())) {
    for (const err of form.engineErrors) {
        reportToSentry(err);
    }
}
```

:::warning Reading validation messages
Read failed value checks through `field.errors`, `field.issues` or the field's `error` flag. A flag is a named state read with `hasFlag`; the field's `error` flag appears after interaction. `form.engineErrors` stores captured exceptions, including a failed API call, rather than the messages added with `report.error(...)`.
:::

## Error properties

| Property | Meaning |
|---|---|
| `scope` | catch path: `"behavior"` or `"validator"` |
| `kind` | `"hook-error"` or `"guard-violation"` |
| `field` | field where the failure was captured |
| `rule` | validator or composite member name, when captured on the validator path |
| `error` | original thrown value, unchanged |
| `at` | capture timestamp from `Date.now()` |

## Error classification

`kind` is determined by the type of the thrown value:

- `guard-violation`: an `EngineGuardError`, such as setting a reserved flag through `mark`.
- `hook-error`: any other thrown value, including network errors and application bugs.

```ts
const bugs = form.engineErrors.filter((err) => err.kind === "guard-violation");
```

`EngineGuardError` is exported. `err.error instanceof EngineGuardError` is the check used for classification.

There is a current exception to the intended guard classification: undeclared `ctx.watched` reads in a behavior or a standalone validator throw a plain `Error`, so they are recorded as `hook-error`. A composite validator's member check throws `EngineGuardError`, giving `guard-violation`. Inspect the message as well when diagnosing dependency declarations.

Errors thrown directly while configuring a form, such as a dependency cycle rejected during field registration, propagate to that caller. They do not pass through this buffer.

## A failed asynchronous rule

```ts
class Available extends IValidator<string> {
    protected async validate(value: string, report: ValidationReport) {
        const taken = await api.isTaken(value);   // the network fails here
        report.errorIf(taken, "Already taken");
    }
}
```

If this request rejects, the validation result gets a blocking issue with `code: "unverified"` when no other blocking issue exists. The exception is also recorded in `form.engineErrors` with `scope: "validator"` and `rule: "Available"`.

The issue tells the view why it cannot submit; the diagnostic preserves the underlying error for investigation. A composite validator keeps the messages of its other members even if one fails. See [When validation cannot finish](../model/interrupted-pass.md).

:::warning Direct synchronous exceptions
A validator attached on its own that throws synchronously is currently caught by the field's fallback path. It is recorded with `scope: "behavior"`, without a `rule`, and the previous validation state may remain. Do not rely on that path to block submission; report expected failures inside the rule.
:::

## Reading the buffer

`engineErrors` is an accessor with no `onEngineError` subscription. You can read it after a failed `submit()`, in a debug panel or in a test.

- It is outside the snapshot, the object used for render state. Adding a diagnostic does not itself notify render subscriptions. The accessor is available on the form controller, not on field views.
- It keeps the 50 most recent errors.
- `reset()` clears it. Submission leaves it intact so errors captured during that submission remain readable.
- Each read returns a copy, ordered from oldest to newest.

:::note Calling a validator outside a form
A direct `validator.handle(value)` call has no form diagnostic sink. An asynchronous rejection can still produce an `unverified` validation issue, but no `engineErrors` record is written. A direct synchronous exception rejects `handle()`; the caller must handle it.
:::
