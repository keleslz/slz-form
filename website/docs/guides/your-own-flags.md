---
id: your-own-flags
title: Your own flags
sidebar_position: 5
description: Extend the vocabulary without touching the engine — and why its own words are refused.
---

# Your own flags

A behavior publishes a word, the view reads it. The engine never had to learn
it.

```ts
onMount: (ctx) => ctx.state.mark("skeleton"),
```

Then, when the data arrives, the behavior removes it:

```ts
ctx.push(ctx.state.unmark("skeleton"));
```

```tsx
{field.hasFlag("skeleton") ? <Skeleton /> : <input … />}
```

That is what makes it possible to express needs nobody planned for — a loading
skeleton, a business check in progress, a badge — without adding anything to
the core.

## Why it is safe

The application's flags join the **cumulative** nature: they add up, and the
union cannot contradict itself. Two behaviors that set `skeleton` at the same
time set `skeleton`; one that removes it simply stops emitting it.

## The engine's words are refused

```ts
ctx.state.mark("error");     // throws
ctx.state.mark("loading");   // throws
```

Setting `error` next to `pristine` would publish a state that does not exist,
and setting `loading` through this path would light up an activity that
nothing could turn off — the union of cumulative flags does not subtract.

The guard is in `mark`, in `unmark` **and** in the `BehaviorState`
constructor: a behavior that returns a hand-built slice does not get around
it.

The exact list is exported — `RESERVED_FLAGS`, and `isReservedFlag(flag)` to
test it.
