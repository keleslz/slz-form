---
id: your-own-flags
title: Your own flags
sidebar_position: 5
description: Publish an application state from a behavior and read it in your components.
---

# Your own flags

This page shows how to add an application flag, such as `skeleton`, without modifying the engine. You will learn how to remove it and which names are reserved.

A flag is a named state your component checks with `hasFlag` or `hasAny`. A behavior reacts to field events and returns or publishes a `BehaviorState`, its contribution to the field's activity and flags. Use `mark` to add a custom flag to that contribution.

For example, a field can show a placeholder while its initial data loads:

```ts
onMount: (ctx) => ctx.state.mark("skeleton"),
```

When the data arrives, the same behavior removes its contribution with `unmark` and publishes the updated state:

```ts
ctx.push(ctx.state.unmark("skeleton"));
```

Your view can then choose between the placeholder and the input:

```tsx
{field.hasFlag("skeleton") ? <Skeleton /> : <input … />}
```

The engine stores the custom flag like other cumulative flags. Your application defines what it means and how to render it. You can use the same mechanism for a business check or a badge.

## Combining contributions

Custom flags from different behaviors are combined. If two behaviors publish `skeleton`, it remains present until both stop publishing it. `unmark("skeleton")` removes it only from the behavior's own state.

`BehaviorState` is immutable: `mark` and `unmark` return a new object. Return that object from the hook or send it through `ctx.push`; calling a method without publishing its result does not change the controller's state.

## Reserved names

Some engine flags use dedicated APIs or are managed by the controller. They cannot be added as custom markers:

```ts
ctx.state.mark("error");     // throws
ctx.state.mark("loading");   // throws
```

Validity flags such as `error` come from validation, and activity is set with `loading()` or `idle()`. This keeps one displayed validity and one activity state on a field. Interaction flags such as `touched` are also reserved.

The check applies in `mark`, `unmark` and the `BehaviorState` constructor. It throws an `EngineGuardError` for a reserved marker, including in a state object constructed by hand.

`RESERVED_FLAGS` exports the exact list; `isReservedFlag(flag)` checks a name. Availability flags `locked`, `readonly` and `invisible` are allowed through `mark` and also have dedicated methods such as `lock()` and `hide()`.
