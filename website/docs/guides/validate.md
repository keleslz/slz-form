---
id: validate
title: Validate
sidebar_position: 2
description: Write validation rules, combine their issues and handle server responses.
---

# Validate

This page shows how to write validation rules, read their messages and combine local checks with server errors. You will also learn how to delay a check while the user types.

A validator checks a field value and reports issues, which are messages with a severity and an optional code. Extend `IValidator<T>` for your value type and add issues to `report`, the `ValidationReport` for that execution. An asynchronous rule returns a promise; the field has the `loading` flag until the validation settles. A flag is a named state your view can check with `hasFlag`.

## A rule

```ts
class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport) {
        report.errorIf(!value.includes("@"), "Invalid email address");
    }
}
```

Attach an instance through the field's `validator` option. The base validator handles the field's `required` option in addition to your rule.

:::note Rules on empty values
Custom rules are skipped on empty values unless the validator declares `validateWhenEmpty = true`. Empty values include `undefined`, `null`, blank strings and empty arrays. `false` is empty only with `requiredTrue: true`. If your rule decides that a field is required under a condition, enable `validateWhenEmpty` and account for `undefined` in the rule.
:::

## Severity and codes

For a customer reference, a format error can block submission. For a postcode, you might only want to warn about an unusual value:

```ts
report.error("Expected format: CUST-42-9013", { code: "format" });
report.warn("This postcode looks unusual", { code: "unusual" });
```

An issue with severity `error` blocks submission; severity `warning` does not. `code` is an optional application identifier you can use to choose where to display or translate the message, for example under the input or in a snackbar. The engine stores it without choosing the presentation.

Read all messages and their metadata through `field.issues`, blocking messages through `field.errors`, and warnings through `field.warnings`. The field's `error` flag controls displaying blocking errors after interaction. A prefilled field is validated but stays `pristine` until it is touched.

## Reading another field

`watch` lists the fields whose value changes should rerun a validator. `ctx.watched` gives a read-only view of a declared field:

```ts
class SameAsPassword extends IValidator<string> {
    readonly watch = ["password"];
    protected validate(value: string, report: ValidationReport, ctx: ValidationContext) {
        report.errorIf(value !== ctx.watched("password")?.value, "Does not match");
    }
}
```

`ctx.watched` throws for an undeclared name. It returns `null` if the declared field is unavailable. Reading through `ctx.form` does not register a dependency automatically; keep `watch` explicit.

## Several validators on one field

`ExternalValidator` stores issues supplied by your application, such as a server response to a submitted email. Pass an array to combine it with local rules:

```ts
const serverIssues = new ExternalValidator<string>();

form.field("email", { validator: [new EmailValidator(), serverIssues] });

// after a 422
serverIssues.set([{ message: "Already taken", severity: "error", code: "taken" }]);
```

The controller creates a composite validator from the array. It runs the members and combines their issues; each member keeps its own rules and declared dependencies. `set()` requests a fresh validation so the injected issues become visible in the field's result. `clear()` removes them and requests validation again.

Injected issues bind to the value seen by the first validation after `set()`. They stop applying to a field when that value changes and do not return until another `set()`. If the user edits while your HTTP request is pending, compare the current value with the value you sent before calling `set()`: the helper does not make that comparison for you. Use a separate `ExternalValidator` instance per field when server issues should be independent; `set`, `clear` and `reset` affect every field sharing an instance.

## When a rule fails

An asynchronous rejection or a failed composite member keeps collected blocking errors, or adds an issue with `code: "unverified"` if none exist. Direct synchronous validators have a different failure path. See [When validation cannot finish](../model/interrupted-pass.md) for the exact behavior and how to report an unavailable check explicitly.

## Deferring a validation

A debounce delays a check while changes arrive close together. `DebouncedValidator` wraps a validator and waits for the configured interval before running it:

```ts
new DebouncedValidator(new EmailValidator(), 400);
```

The field becomes `loading` during the delay and the check. The controller calls `IValidator.flush()` on blur and submission to start the pending check immediately, then submission waits for the result. The base `flush` is a no-op; `DebouncedValidator` implements it. The base required check is not delayed.

:::tip Choosing what to debounce
Use `DebouncedValidator` to delay a value check, for example an email availability request. Use `lookup` with a debounce to delay a behavior that fetches and writes a value. A behavior reacts to field events and updates its own field; a validator reports the issues used to calculate validity.
:::
