---
id: behavior-and-validator
title: Behavior or Validator?
sidebar_position: 2
description: A behavior reacts, a validator judges. What each one can do, the hooks a behavior receives, and how to choose.
---

# Behavior or Validator?

Everything you attach to a field is one of two things:

- a **behavior** reacts — it fills the value, loads options, sets `loading`,
  `locked`, `readonly` or `invisible`;
- a **validator** judges — it says whether the value is accepted. It is the
  **only** source of validity.

| | Validator | Behavior |
|---|---|---|
| Question it answers | "is this value acceptable?" | "what should happen when…?" |
| What it produces | issues: `message`, `severity`, `code` | flags on its own field |
| Writes the value | no | yes — **its own field's** value only |
| Effect on submission | direct: a blocking issue stops it | indirect: `submit()` waits for its async work |

Rule of thumb: if the question is "**is it valid?**", write a validator. If it
is "**what should happen?**", write a behavior.

The goal behind this split: **anything you can do with `useState` and
`useEffect` must be doable here** without modifying the engine. The test file
`packages/form/test/parity.test.ts` rewrites each such case with a behavior or a
validator, and never reaches for the `FormController` from inside one.

## Why validity is not shared

If a behavior could write validity, two sources could disagree, and there is no
right way to arbitrate between them. Keeping a single judge is what makes the
flags trustworthy: `valid` means a validator ruled, not that some component
decided so.

So the validator gets what it needs to judge — never a way to write:

- **read access to other fields**: it declares them in `watch` and reads them
  with `ctx.watched(name)`;
- **a way to ask for a re-run**: inside a validator subclass,
  `this.requestRevalidation()` re-runs it when its verdict can change while the
  value did not — this is how `ExternalValidator` applies server errors.

| Need | How |
|---|---|
| Confirm a password, compare two dates | the validator declares `watch` and reads `ctx.watched(...)` |
| `required` only in some cases | the validator decides, with `validateWhenEmpty = true` |
| An error returned by the server | an `ExternalValidator`, next to your rules: `validator: [rules, serverIssues]` |
| Re-judge with no new keystroke | `this.requestRevalidation()` from the validator |
| A warning that does not block | `report.warn(...)` |
| Show a message in a toast, not under the field | `report.error(message, { code })`, and the view routes on `code` |
| Lock a field until another is valid | `lockUntilValid({ watch })` |
| Invoice lines, dynamic lists | `form.array("lines")` — [a row is a form](a-row-is-a-form.md) |

Writing validators: [Validate](../guides/validate.md).

## Writing a behavior

A behavior is a plain object (or an instance of the `Behavior` base class) with
optional **hooks** — functions the engine calls at a moment of the field's life:

| Hook | Called when |
|---|---|
| `onMount(ctx)` | the field is mounted, and again on `reset()` |
| `onChange(ctx, value)` | the field's value changed — by the user **or** by code (see the caution below) |
| `onFocus(ctx)` / `onBlur(ctx)` | the input gains or loses focus |
| `onSubmit(ctx)` | the form is being submitted |
| `onDependencyChanged(ctx, dependency)` | a field listed in `watch` changed — its value by default ([details](../guides/dependencies.md)) |
| `onUnmount(ctx)` | the field is unmounted — clean up here; writes are ignored |

A hook returns the flags the behavior wants on the field — a `BehaviorState`,
built from `ctx.state` — or a promise of one, or nothing ("no change").

```ts
import type { IBehavior } from "slz-form";

const lockedWhileEmpty: IBehavior<string> = {
    onMount: (ctx) => (ctx.getValue() ? ctx.state.unlock() : ctx.state.lock()),
    onChange: (ctx, value) => (value ? ctx.state.unlock() : ctx.state.lock()),
};
```

`ctx` is what a hook receives:

| Member | What it is |
|---|---|
| `ctx.state` | the flags **this behavior** currently sets, as a `BehaviorState`. Its methods return a new state: `loading()`, `idle()`, `lock()`, `unlock()`, `readOnly()`, `writable()`, `hide()`, `show()`, `mark(word)`, `unmark(word)`, `clear()` |
| `ctx.push(state)` | publishes a state **now**, before the hook returns — the way to show `loading` during an `await` |
| `ctx.getValue()` / `ctx.setValue(value)` | read or write this field's value. `setValue` does not mark the field touched |
| `ctx.clear()` | empties the value **and** makes the field untouched again, so no "required" error appears for a clearing the user did not do |
| `ctx.setOptions(options)` | publishes the option list (select, radio…) |
| `ctx.watched(name)` | reads a field declared in `watch`: `value`, `errors`, `hasFlag(...)`. Throws for an undeclared name |
| `ctx.ui` | the field's merged flags — everything every behavior and the validator say |
| `ctx.form` | read access to the form: `name`, `status`, `field(name)`, `values()` |
| `ctx.signal` | an `AbortSignal` aborted when the field unmounts — pass it to `fetch`, check it after each `await` |

:::caution `onChange` also fires on programmatic writes
`onChange` means "the value changed", not "the user typed". It runs for
`field.change()`, but also for `ctx.setValue()`, `ctx.clear()` and
`field.update({ value })` — so a prefill or a lookup triggers the `onChange` of
the other behaviors on that field. The hook is not told where a write came
from; the closest signal is `ctx.ui.hasFlag("touched")`, which says whether the
user has interacted with the field at all.
:::

:::caution `ctx.form` is a one-off read
`ctx.form.field(name)` and `ctx.form.values()` read any field without checking
`watch`, and nothing re-runs your hook when what you read changes. Use
`ctx.watched(name)` for anything you depend on; keep `ctx.form` for one-off
reads such as the form's `name`.
:::

## A behavior holds no field state

A behavior *returns* its flags; the field stores them. An instance may carry
**configuration** — a URL, a delay — but never the state of a field. That is
what lets you share one instance between fields:

```ts
const prefillFromProfile = prefill(fetchProfileDefault);

form.field("shipTo", { behaviors: [prefillFromProfile] });
form.field("billTo", { behaviors: [prefillFromProfile] });
```

A **validator** instance, on the other hand, holds its field's verdict: giving
the same instance to two fields throws when the second one is created. Create
one per field.

## A field reads its neighbors, it never writes to them

A field is the source of truth for itself and nothing else. To fill `city` from
`postcode`, the behavior goes on `city` and watches `postcode` — never the other
way around. See [Declared dependencies](../guides/dependencies.md).
