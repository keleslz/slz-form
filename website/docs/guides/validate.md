---
id: validate
title: Validate
sidebar_position: 2
description: Write a rule, report blocking issues and warnings with codes, read other fields, combine validators, and show server errors.
---

# Validate

A validator **judges** a value: it is the only source of validity for its
field. You extend `IValidator<T>`, where `T` is the type of the value, and
report issues through `report`.

## A rule

```ts
import { IValidator, type ValidationReport } from "slz-form";

class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport) {
        report.errorIf(!value.includes("@"), "Invalid email address");
    }
}

form.field("email", { required: true, validator: new EmailValidator() });
```

The rule runs every time the value changes — on `change()`, on a value written
by a behavior, when the field mounts — and again on blur and on submission.

A rule can be `async`: return a promise, and the field carries `loading` until
it settles. Pass `ctx.signal` (the third argument) to `fetch`, so a request is
cancelled when the field unmounts.

:::caution Give one validator instance to one field
A validator instance holds its field's verdict. Passing the same instance as
the `validator` of two fields throws when the second field is created. Create
one per field. (A member of an array of two or more validators may be shared:
the array holds the verdict.)
:::

## Empty values and `required`

Rules **do not run on an empty value** — `undefined`, `null`, a blank string,
an empty array. Whether an empty field is acceptable is what `required` says:

| Field option | Effect |
|---|---|
| `required: true` | an empty value gets a blocking issue, `code: "required"`, message `"This field is required"` |
| `requiredMessage: "…"` | replaces that message |
| `requiredTrue: true` | with `required: true`, also treats `false` as empty — for a checkbox that must be ticked. On its own it only makes rules skip `false`; use it with `required: true` |

A rule that decides **itself** whether the field is required ("required if the
account is a company") must run on empty values: declare
`readonly validateWhenEmpty = true`, and the value it receives may be
`undefined`.

## Issues: severity and code

```ts
report.error("Expected format: CUST-42-9013", { code: "format" });
report.warn("This postcode looks unusual", { code: "unusual" });
report.errorIf(condition, "message", { code: "…" });
report.warnIf(condition, "message", { code: "…" });
```

- An **error** blocks submission. A **warning** does not.
- The `code` is for **you**: show the message under the field, in a toast, or
  not at all, translate it… The engine carries `severity` and `code` and never
  decides how anything is displayed.

On the field, read them as data:

| Read | Gives |
|---|---|
| `snapshot.errors` | blocking messages only |
| `snapshot.error` | the first blocking message, or `undefined` |
| `snapshot.warnings` | non-blocking messages |
| `snapshot.issues` | every issue, with `message`, `severity` and `code` |

`form.snapshot.errors` gives the blocking messages of every mounted, visible
field, keyed by field name — and, for each list with a blocking issue, the
messages of its rows under the list's name.

The engine writes two messages itself: `"This field is required"`
(`code: "required"`, replaceable with `requiredMessage`) and
`"Validation unavailable"` (`code: "unverified"`, see
[An interrupted pass](../model/interrupted-pass.md)). To translate them, route
on `code`.

## Reading another field

Declare the fields the rule reads in `watch`; the rule is re-run when **their
value** changes.

```ts
import { IValidator, type ValidationContext, type ValidationReport } from "slz-form";

class SameAsPassword extends IValidator<string> {
    readonly watch = ["password"];
    protected validate(value: string, report: ValidationReport, ctx: ValidationContext) {
        report.errorIf(value !== ctx.watched("password")?.value, "Does not match");
    }
}
```

`ctx.watched(name)` **throws** for a name not listed in `watch`. The engine
catches that error, so nothing crashes: depending on the rule, the field gets
an `"unverified"` issue or keeps a stale verdict, and the error is recorded in
`form.engineErrors` — easy to miss if you never read it. See
[Reading a watched field](dependencies.md#reading-a-watched-field).

:::caution Use `ctx.watched()`, not `ctx.form.field()`
`ctx.form.field(name)` and `ctx.form.values()` also read other fields, but
nothing checks them against `watch` and nothing re-runs the rule when they
change: the verdict silently goes stale. Read what you depend on with
`ctx.watched()`.
:::

A cross-field rule shows its error on the field that carries it, and only once
that field is touched. If `confirm` already holds a value but is untouched when
a change to `password` makes it wrong, the form's verdict turns to `error` while
`confirm` displays nothing — until the user reaches it, or submits. Put the rule
on the field the user fills last, or display `form.snapshot.errors`.

## Several validators on one field

Pass an array. Each validator keeps its own rules, and their issues are added
up:

```ts
import { ExternalValidator } from "slz-form";

const serverIssues = new ExternalValidator<string>();

form.field("email", { validator: [new EmailValidator(), serverIssues] });

// after the server answered 422
serverIssues.set([{ message: "Already taken", severity: "error", code: "taken" }]);
```

`ExternalValidator` carries issues that come from outside — typically a server
response. `set()` applies them right away, even though the value did not
change; they are **cleared as soon as the value changes**, because a server
error is about what was sent, not about what the user is now fixing.
`clear()` removes them by hand.

Only `severity: "error"` blocks. If your server uses other words, map them to
`"error"` or `"warning"` before calling `set()`.

## Waiting before validating

```ts
import { DebouncedValidator } from "slz-form";

new DebouncedValidator(new UsernameValidator(), 400);
```

`UsernameValidator` stands for any rule of yours — typically one that asks the
server whether the name is free. `DebouncedValidator` waits until the user stops
typing for 400 ms before running the rule it wraps. The field is `loading` from
the first keystroke. Leaving the field or submitting runs the waiting rule
immediately, so a form submitted within the 400 ms is never judged on a stale
verdict. `required` is not delayed.

:::tip Two kinds of debounce
`DebouncedValidator` delays a validator, which **judges** a value. The
`debounce` option of `lookup` and `loadOptions` delays a behavior, which
**writes** a value or options. One cannot replace the other.
:::

## When a rule crashes

If an `async` rule rejects, or a rule inside an array of two or more
validators throws, the field gets a blocking `"unverified"` issue (or another
rule's refusal) — not `valid`, not the previous verdict. A plain synchronous
rule that throws currently **keeps its previous verdict**, and the value can be
submitted: that is a known gap, with its workaround, in
[An interrupted pass is not a verdict](../model/interrupted-pass.md).
