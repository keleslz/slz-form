---
id: dependencies
title: Declared dependencies
sidebar_position: 3
description: Watch a neighbor — its value, or its state — without ever writing to it.
---

# Declared dependencies

A behavior lists the fields it watches. The graph is built at wiring time: a
**cycle is rejected there**, not discovered as an infinite loop at runtime.

```ts
const { lockUntilValid } = behaviorsFor(form);

lockUntilValid({ watch: ["postcode"] });
```

## Which axis wakes you up

A bare name is triggered by the **value**:

```ts
{ watch: ["postcode"] }                                   // ≡ on: ["value"]
```

That is the default, and it keeps a revalidation from replaying the network
calls of the behaviors that watch the field. To react to something else, you
name the axis:

```ts
{ watch: [{ field: "postcode", on: ["value"] }] }      // default — the value changes
{ watch: [{ field: "postcode", on: ["validity"] }] }   // the verdict — what lockUntilValid does
{ watch: [{ field: "postcode", on: ["activity"] }] }   // loading / idle
```

`onDependencyChanged(ctx, dependency)` then receives the view of the watched
field — `dependency.value`, `dependency.errors`, `dependency.hasFlag(...)` —
read-only.

## Read, never write

A field can read the others; it can **never** write one. Cross-field locking,
hiding and reloading all go through that read, with no mutation.

That is what makes the graph reliable: if writing to a neighbor were possible,
the execution order would become observable, and two behaviors could
contradict each other without either being wrong.

## Reading an undeclared field throws

```ts
ctx.watched("postcode")   // ✓ declared
ctx.watched("city")       // ✗ throws — reads "city" without declaring it in `watch`
```

The error is immediate and named. An implicit dependency is precisely what you
do not want to be able to set up by inattention.
