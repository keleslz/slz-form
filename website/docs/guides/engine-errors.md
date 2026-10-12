---
id: engine-errors
title: Engine errors
sidebar_position: 6
description: What becomes of a hook or a rule that throws — form.engineErrors, hook-error and guard-violation.
---

# Engine errors

The engine **never logs**. When a behavior hook rejects, a validation rule
crashes or an engine guard is violated, the error has no one to bubble up to:
the promise that carries it is awaited by no one. Rather than writing it to
the console, the engine **routes** it to the form.

```ts
if (!(await form.submit())) {
    for (const err of form.engineErrors) {
        reportToSentry(err);
    }
}
```

:::warning This is not how you read a validation error
A field that fails its rules is not an engine error: read it with
`field.errors`, `field.issues` or `field.hasFlag("error")`. `engineErrors`
only contains what **threw**.
:::

## What an error carries

| Property | What it says |
|---|---|
| `scope` | where it comes from: `"behavior"` or `"validator"` |
| `kind` | its nature: `"hook-error"` or `"guard-violation"` |
| `field` | the field where it happened |
| `rule` | the name of the faulty rule or member — validator side only |
| `error` | the thrown object, as is: the engine does not interpret it |
| `at` | the capture timestamp (`Date.now()`) |

## Your code, or your use of the API?

`kind` separates the two, and that is what tells you where to look.

- **`hook-error`** — **your** code threw: a network failure, an unreadable
  response, an application bug.
- **`guard-violation`** — the **engine** threw, because a contract was broken:
  a reserved flag set through `mark`, a field read without being declared in
  `watch`.

```ts
const bugs = form.engineErrors.filter((err) => err.kind === "guard-violation");
```

A guard throws an `EngineGuardError`, which is exported: `err.error instanceof
EngineGuardError` gives the same answer as `kind`.

## A rule that crashes

```ts
class Available extends IValidator<string> {
    protected async validate(value: string, report: ValidationReport) {
        const taken = await api.isTaken(value);   // the network fails here
        report.errorIf(taken, "Already taken");
    }
}
```

Two things happen, on two distinct surfaces:

- the field becomes **unverified, and blocking** — see
  [An interrupted pass is not a verdict](../model/interrupted-pass.md);
- the error lands in `form.engineErrors`, with `scope: "validator"` and
  `rule: "Available"`.

The first tells the user that the form cannot go out; the second tells you
**why**. In an array of validators, a member that crashes does not take
another's issue down with it: the rejection from a healthy rule survives.

## A buffer you read, not an event

`engineErrors` is an accessor, not a subscription — there is no
`onEngineError`. An engine error is a crash the engine **already recovered
from**: a diagnostic record, not a live event to handle in real time. You read
it when you have a reason to — after a rejected `submit()`, in a debug panel,
in a test.

- It is **outside the snapshot**: it is not render state, writing to it
  re-renders nothing, and it only exists at the form — never on a field.
- It is **bounded** to the 50 most recent errors.
- `reset()` clears it. Submission leaves it intact, so that an error raised
  while submitting stays readable afterwards.
- Each read returns a **copy**, from oldest to most recent.

:::note A validator called outside a form stays silent
`validator.handle(value)` called by hand has no form to route to. If it
crashes, nothing is recorded anywhere — a blind spot, accepted as such.
:::
