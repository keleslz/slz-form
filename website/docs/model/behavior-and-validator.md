---
id: behavior-and-validator
title: Behaviors and validators
sidebar_position: 2
description: Choose where to put value updates, availability rules and validation checks.
---

# Behaviors and validators

This page explains where to put loading, locking and validation rules. You will be able to choose a behavior or a validator for each part of a form.

A behavior reacts to a field event and can update that field's value, options or flags. A flag is a named state such as `loading` or `locked`. A validator checks a value and reports issues: messages with a severity and an optional code.

In a car form, fetching models after a brand change belongs in a behavior. Checking that a postcode has the required format belongs in a validator.

| | Validator | Behavior |
|---|---|---|
| Purpose | check a value | react to an event |
| Output | issues with `severity`, `message`, `code` | a `BehaviorState` describing activity and availability |
| Updates the value | no mutation API in its context | can update its own field |
| Submission | error issues block it | `submit()` waits for relevant pending work |

`BehaviorState` contains one behavior's contribution to the field state. The controller stores and combines these contributions; a behavior result has no setting for validity.

## Validation that depends on other data

A validator can read other fields by declaring them in `watch` and calling `ctx.watched(...)`. `watch` records the dependency so a change triggers another validation. For example, postcode rules might depend on the selected country.

A validator can also call the protected `requestRevalidation()` method when its rules need to run again even though the input value has not changed. `ExternalValidator` uses this when new server issues arrive.

| Need | API |
|---|---|
| Confirm a password or compare dates | declare `watch`, then read `ctx.watched(...)` |
| Require a value only under a condition | check the condition in a validator with `validateWhenEmpty` |
| Show a server validation error | compose `ExternalValidator` with local validators |
| Recheck without a value change | call `requestRevalidation()` in a validator |
| Report a non-blocking warning | `report.warn(...)` |
| Display a message in a snackbar | attach a `code` with `report.error(msg, { code })`, then read it in the view |
| Lock until another field has no blocking errors | `lockUntilValid({ watch })` |
| Manage invoice lines | `form.array("lines")`, where each row has its own form |

`validateWhenEmpty` allows your rule to run when the field has no value. Without it, the base validator handles `required` and skips your custom rule on empty values.

## Keeping behavior state on the controller

Return a state contribution, or publish it with `ctx.push`, and let the controller store it. Keep field-specific state out of the behavior instance if you want to share it. Otherwise, two fields using that instance could change each other's state.

```ts
// Each field stores its own prefilled value.
const prefillFromProfile = prefill(fetchProfileDefault);

form.field("shipTo", { behaviors: [prefillFromProfile] });
form.field("billTo", { behaviors: [prefillFromProfile] });
```

The built-in prefill helper keeps the returned value on each field controller. It can therefore be reused for shipping and billing without sharing those field values. `prefill` is a behavior that fetches a value when the field mounts.

## Reading other fields

The context gives a behavior methods to update its own field and read-only views of other fields. For example, the model field can read the brand and reload its own options. It does not receive a method for changing the brand.

Use `watch` for changes that should trigger a reaction. Reading the whole form through `ctx.form` does not subscribe to changes automatically. See [Declared dependencies](../guides/dependencies.md).
