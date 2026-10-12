---
id: interrupted-pass
title: When validation cannot finish
sidebar_position: 3
description: Handle unavailable validation checks and understand when loading ends.
---

# When validation cannot finish

This page explains what happens when a validation check fails to finish and how to handle an unavailable service. It also explains how a custom behavior keeps or releases its loading state.

A validator checks a field value and collects issues in a `ValidationReport`. An issue is a message with severity `error` or `warning` and an optional code. A validation run is one execution of those checks for the current value.

For example, an email format check may finish while a separate availability request fails. The completed check's messages remain useful, but the failed request still needs to be accounted for.

## Results after an asynchronous failure

When a validator promise rejects, or a member of a composite validator throws, the report is marked interrupted. A composite validator combines several validators on one field.

| Result of the run | Published issues |
|---|---|
| all checks finish | collected issues; `valid` if there are no errors |
| a check fails and another has reported an error | collected issues, including the blocking error |
| a check fails and no error has been reported | collected issues plus a blocking issue with `code: "unverified"` |

`unverified` identifies an issue through its `code` property in `field.issues`. Its message is `Validation unavailable`. It blocks submission because the checks could not establish that the value was acceptable. These failure paths replace the previous validation result rather than accepting the value on the basis of missing errors.

:::warning Direct synchronous validators
A synchronous exception thrown by a validator attached on its own currently follows a different path. The field catches it, records it in `form.engineErrors` with `scope: "behavior"`, and may leave the previous validation state in place. This path does not guarantee an `unverified` issue. Catch expected failures inside the rule and report the result explicitly. See [Engine errors](../guides/engine-errors.md).
:::

## Allowing an unavailable check

If an unavailable service should produce a warning and allow submission, catch that failure in the rule. Here the availability check reports a warning when the service fails:

```ts
protected async validate(value: string, report: ValidationReport) {
    try {
        const taken = await isTaken(value);
        report.errorIf(taken, "Already taken", { code: "taken" });
    } catch {
        report.warn("Check unavailable", { code: "offline" });
    }
}
```

This rule completes normally with a non-blocking warning. Submission can succeed if the other rules have no blocking errors. Use `report.error(...)` in the catch instead if the service failure should block the form.

## Loading in custom behaviors

A behavior reacts to field events and can publish state with `ctx.push` or return a `BehaviorState`. `BehaviorState` describes that behavior's activity and flags, which the controller combines with the other sources. The `loading` flag indicates waiting work; the validator can also contribute it.

A promise returned by a behavior does not automatically publish `loading`. The behavior requests it with `ctx.state.loading()`. For each behavior call, the controller tracks whether that call still contributes loading:

- A call returning `ctx.state.idle()` releases its own wait. Other calls or validators can keep the field `loading`.
- For an asynchronous hook, loading pushed during the call ends when its promise settles, unless its return value explicitly requests `loading` again.
- A synchronous hook can publish loading for work it starts outside its return value. It must later publish idle when that work ends.

```ts
onChange: async (ctx) => {
    ctx.push(ctx.state.loading());
    await préparer();
    envoyerEnTâcheDeFond();
    return ctx.state.loading();   // otherwise the waiting ends with the promise
},
```

In this example, the explicit `loading()` in the return value keeps loading active for the background work. That work must later call `ctx.push(ctx.state.idle())` to release it. `ctx.state` reads the current state contribution of this behavior, including after an `await`.
