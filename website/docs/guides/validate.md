---
id: validate
title: Validate
sidebar_position: 2
description: Issues, severity, codes, composed validators and server errors.
---

# Validate

A validator **judges** a value: it is the single authority on validity. You
extend `IValidator<T>` and report its issues through `report`; an asynchronous
rule returns a promise, and the field carries `loading` until it settles.

## A rule

```ts
class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport) {
        report.errorIf(!value.includes("@"), "Invalid email address");
    }
}
```

:::note Rules do not run on an empty value
Unless the validator declares `validateWhenEmpty = true`. A rule that decides
on its own whether the field is required must therefore say so, otherwise it
will never be called on the case it cares about.
:::

## An issue carries a severity and a code

```ts
report.error("Expected format: CUST-42-9013", { code: "format" });
report.warn("This postcode looks unusual", { code: "unusual" });
```

A warning **does not block** submission. The `code` is there so that **you**
decide: snackbar, under the field, or nothing. The engine carries `severity`
and `code`; it never displays anything, and knows neither color nor label.

## Reading another field

The validator declares what it watches, and is re-run when that changes.

```ts
class SameAsPassword extends IValidator<string> {
    readonly watch = ["password"];
    protected validate(value: string, report: ValidationReport, ctx: ValidationContext) {
        report.errorIf(value !== ctx.watched("password")?.value, "Does not match");
    }
}
```

`ctx.watched` **throws** on an undeclared name: a reactive dependency stays
explicit, and cannot be set up by accident.

## Several validators on one field

```ts
const serverIssues = new ExternalValidator<string>();

form.field("email", { validator: [new EmailValidator(), serverIssues] });

// after a 422
serverIssues.set([{ message: "Already taken", severity: "error", code: "taken" }]);
```

An array becomes a composite, invisible to the caller: each member keeps its
rules, the issues are aggregated.

Injected issues **are cleared as soon as the value changes**: a server error
is about what was sent, not about what the user is busy fixing.

## When a rule crashes

See [An interrupted pass is not a verdict](../model/interrupted-pass.md) —
it is the subtlest point of validation, and the one that has regressed the
most.

## Deferring a validation

```ts
new DebouncedValidator(new EmailValidator(), 400);
```

`IValidator.flush()` lets the field rule without waiting, on blur and on
submission — otherwise a form submitted within the 400 ms would go out on a
verdict that has not been returned yet.

:::tip Two debounce mechanisms, and they are not interchangeable
`DebouncedValidator` defers a validator, which **judges** a value. `lookup`
defers a behavior, which **writes** one. They land on two different axes, and
neither can do the other's job.
:::
