---
id: your-own-flags
title: Your own flags
sidebar_position: 6
description: Publish your own state words from a behavior — a skeleton, a badge — and read them in the view, without touching the engine.
---

# Your own flags

The engine's flags cover its own needs. When your product needs another state —
a loading skeleton, a "verified" badge, a business check in progress — a
behavior publishes your own word, and the view reads it with `hasFlag`. The
engine carries the word without having to know it.

```ts
import type { IBehavior } from "slz-form";

const skeletonUntilLoaded: IBehavior<string> = {
    onMount: async (ctx) => {
        ctx.push(ctx.state.mark("skeleton"));
        const name = await loadProfile(ctx.signal);
        if (!ctx.signal.aborted) {
            ctx.setValue(name);
        }
        return ctx.state.unmark("skeleton");
    },
};
```

```tsx
{field.hasFlag("skeleton") ? <Skeleton /> : <input … />}
```

- `ctx.state.mark(word)` adds the word to the flags this behavior sets;
  `ctx.state.unmark(word)` removes it.
- `ctx.push(...)` publishes it immediately, before the `await`.
- If the hook's promise rejects, what this call had added — here `skeleton` —
  is removed, and the error goes to [`form.engineErrors`](engine-errors.md).

## Why it is safe

Your words are **cumulative** flags: they add up, and a set of words cannot
contradict itself. Two behaviors that set `skeleton` at the same time set
`skeleton`; one that removes it simply stops setting it — the field keeps it as
long as another behavior still sets it.

## The engine's words are refused

```ts
ctx.state.mark("error");     // throws
ctx.state.mark("loading");   // throws
```

Setting `error` next to `pristine` would publish a state that cannot exist, and
setting `loading` this way would turn on a loading state that nothing could
turn off. The check is in `mark`, in `unmark` **and** in the `BehaviorState`
constructor, so a behavior that builds its state by hand does not get around
it. The refusal throws an `EngineGuardError`, recorded in `form.engineErrors`
with `kind: "guard-violation"`.

The words a behavior **may** set from the engine's vocabulary are `locked`,
`readonly` and `invisible`, through `lock()`, `readOnly()` and `hide()`. The
full reserved list is exported: `RESERVED_FLAGS`, and `isReservedFlag(word)` to
test one.

## On a field, not on the form

Your words live on the field whose behavior sets them. The form's vocabulary is
closed — `form.snapshot.hasFlag("saving-draft")` does not compile — so for a
form-wide state of your own, set the word on one field and read that field.
