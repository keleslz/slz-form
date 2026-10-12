---
id: interrupted-pass
title: An interrupted pass is not a verdict
sidebar_position: 3
description: What the engine publishes when a rule breaks, and why it is neither "valid" nor the previous verdict.
---

# An interrupted pass is not a verdict

This is the semantics that regressed the most during development, always through
the same shortcut: *the pass finished, so I have a verdict.* False as soon as a
rule breaks.

Three cases, and only one is correct:

| The pass | What gets published |
|---|---|
| complete | the verdict, `valid` or `error` |
| interrupted, with a refusal | that refusal — it comes from a rule that concluded |
| interrupted, with no refusal | **`unverified`, blocking** |

A network that went down is not a verdict. If there is no refusal, the engine
publishes a blocking issue with `code: "unverified"`: the value was judged by
no one, and declaring it valid would let through what the rule might have
refused.

Two things that are **never** done:

- **keeping the last known verdict** — it was given on *another* value;
- **concluding `valid` from an absence of refusal** when a rule could not
  rule.

## Tolerating your own failure, and saying so

A rule that prefers to let things through when its check is unavailable catches
the failure and says so itself. It has then **concluded**, and the submission
goes through:

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

The difference between the two outcomes is not in the engine: it lies in
whether or not the rule took a position.

## On the behavior side: waiting follows the work in flight

The counterpart, on the activity axis. A field is `loading` if and only if an
open pass of one of its behaviors is still waiting — not because a last write
said `loading`.

Two consequences worth knowing when you write a behavior by hand:

- **a pass that succeeds does not turn off another pass's waiting.** `ctx.state`
  returns the behavior's merged slice; a hook that returns `ctx.state.idle()`
  only says "I, for one, am done";
- **a pass's waiting lasts until its last word.** A synchronous hook speaks one
  last time by pushing, an asynchronous hook by settling. A waiting state pushed
  along the way therefore turns off when the promise settles:

```ts
onChange: async (ctx) => {
    ctx.push(ctx.state.loading());
    await préparer();
    envoyerEnTâcheDeFond();
    return ctx.state.loading();   // otherwise the waiting ends with the promise
},
```

Without this rule, a stale response that says nothing would keep the field busy
forever.
