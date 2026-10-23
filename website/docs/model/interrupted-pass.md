---
id: interrupted-pass
title: An interrupted pass is not a verdict
sidebar_position: 3
description: What the engine publishes when a rule crashes, why it is neither "valid" nor the previous verdict, and how a behavior's loading state ends.
---

# An interrupted pass is not a verdict

A **pass** is one run of a validator on one value — every rule it contains —
or one call of a behavior's hook. A pass is **interrupted** when it cannot
finish: a rule throws, a network call rejects.

The tempting shortcut is *"the pass finished, so I have a verdict."* It is
wrong as soon as a rule crashes. Here is what the engine publishes:

| The validator's pass | What the field gets |
|---|---|
| completed | the verdict: `valid`, or `error` with the issues found |
| interrupted, after another rule refused the value | that refusal — it comes from a rule that did conclude |
| interrupted, with no refusal | a blocking issue with `code: "unverified"` (message: `"Validation unavailable"`) |

A network that went down is not a verdict. The value was judged by no one, and
calling it valid would let through what the rule might have refused. Keeping
the previous verdict would be wrong too: it was given on *another* value.

The crash itself is recorded in `form.engineErrors`, with `scope: "validator"`
and the rule's name — see [Engine errors](../guides/engine-errors.md).

:::caution Known gaps in the current version
Two cases do not follow the table yet:

- **A rule that throws synchronously keeps the previous verdict.** If
  `validate()` is not `async` and throws — `new URL(value)` on a malformed
  string, `JSON.parse` — the field keeps whatever verdict it had before, and an
  invalid value can be submitted. The crash is recorded with
  `scope: "behavior"`. A rule declared `async`, or a member of an array of two
  or more validators, is handled as documented — an array of one is unwrapped
  to the plain rule, and has the gap. Until this is fixed, catch the error and
  report it yourself (example below). Declaring the rule `async` also works,
  but then the field shows `loading` on every run.
- **A rule whose promise never settles gets its previous verdict back** once
  `submit()` gives up waiting (`settleTimeout`). The submission is refused, but
  the field shows its old verdict until the next run. Worse, if the rule is
  re-validating a value that changed while `submit()` was waiting, `submit()`
  does not give up at all and never returns — see
  [Settings](../guides/submit.md#settings). Give network calls a timeout —
  `AbortSignal.timeout(ms)` — so they always settle.
:::

## Choosing to tolerate a failure

A rule that would rather let the value through when its check is unavailable
catches the failure and says so. It has then **concluded**, and the submission
can go through:

```ts
class Available extends IValidator<string> {
    protected async validate(value: string, report: ValidationReport) {
        try {
            const taken = await isTaken(value);
            report.errorIf(taken, "Already taken", { code: "taken" });
        } catch {
            report.warn("Check unavailable", { code: "offline" });
        }
    }
}
```

The same pattern protects a synchronous rule from the gap above:

```ts
class HttpsOnly extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        let url: URL;
        try {
            url = new URL(value);
        } catch {
            report.error("Not a valid URL", { code: "format" });
            return;
        }
        report.errorIf(url.protocol !== "https:", "Use an https:// address", { code: "https" });
    }
}
```

The engine does not decide between "block" and "let through": the rule does,
by reporting — or not.

## On the behavior side: `loading` follows the work in flight

The same idea applies to a behavior's `loading` flag. A pass is **open** from
the moment its hook is called until it finishes — a synchronous hook when it
returns, an asynchronous hook when its promise settles — and it stays open
after that only if it finished by asking for `loading` (below). A behavior
contributes `loading` to its field if and only if one of its open passes asked
for it — not because some write said `loading` last. (The field is also
`loading` while its validator runs an `async` rule.)

Two consequences when you write a behavior by hand:

- **one pass finishing does not end another pass's loading.** `ctx.state` is
  the behavior's current flags; a hook that returns `ctx.state.idle()` only
  says "this pass is done";
- **what counts is how the pass finishes.** For a synchronous hook, that is
  its return value — or, if it returns nothing, its last `ctx.push`; for an
  asynchronous hook, the value its promise resolves to. So `loading` pushed
  during an `await` ends when the promise settles — unless the hook returns
  `loading` again:

```ts
onChange: async (ctx) => {
    ctx.push(ctx.state.loading());
    await prepare();
    sendInBackground(() => ctx.push(ctx.state.idle()));
    return ctx.state.loading();   // still loading until the callback above runs
},
```

Without this rule, a late response that says nothing would keep the field busy
forever. A field left `loading` this way is released by `submit()` when its
`settleTimeout` expires.
