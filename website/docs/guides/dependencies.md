---
id: dependencies
title: Declared dependencies
sidebar_position: 3
description: Make a field react to another one — its value, its verdict or its loading state — by declaring it in watch, without ever writing to it.
---

# Declared dependencies

When a field must react to another one — reload its options when `brand`
changes, lock until `postcode` is valid — the behavior or validator lists that
other field in `watch`. The engine then calls it again whenever the watched
field changes.

```ts
const { lockUntilValid } = behaviorsFor(form);

form.field("city", { behaviors: [lockUntilValid({ watch: ["postcode"] })] });
```

The engine builds a graph of who watches whom when each field is created. A
**cycle** (`a` watches `b`, `b` watches `a`) or a field watching itself is
**rejected right there** — `form.field()` throws — rather than found later as
an infinite loop.

## The receiving side does the work

A field can read the others; it can **never** write to one. To clear `region`
when `country` changes, the behavior goes on `region` and watches `country`:

```ts
const clearWhenCountryChanges: IBehavior<string> = {
    watch: ["country"],
    onDependencyChanged: (ctx) => ctx.clear(),
};

form.field("region", { behaviors: [clearWhenCountryChanges] });
```

If several fields must react to one, each declares its own behavior. That is
what keeps the graph predictable: if a field could write to its neighbors, the
order in which behaviors run would become visible, and two behaviors could
overwrite each other without either being wrong.

## What wakes a behavior up

A bare name wakes the behavior when the watched field's **value** changes:

```ts
{ watch: ["postcode"] }                                   // same as on: ["value"]
```

That is the default on purpose: touching or re-validating `postcode` does not
replay the network calls of the behaviors that watch it. To react to something
else, name it:

```ts
{ watch: [{ field: "postcode", on: ["value"] }] }      // the value changed (default)
{ watch: [{ field: "postcode", on: ["validity"] }] }   // its verdict or displayed validity changed
{ watch: [{ field: "postcode", on: ["activity"] }] }   // it went loading / idle
```

`onDependencyChanged(ctx, dependency)` then receives a **read-only** view of
the watched field — `dependency.name`, `dependency.value`,
`dependency.errors`, `dependency.hasFlag(...)`:

```ts
const lockWhileCountryInvalid: IBehavior<string> = {
    watch: [{ field: "country", on: ["value", "validity"] }],
    onDependencyChanged: (ctx, dependency) =>
        dependency.errors.length > 0 ? ctx.state.lock() : ctx.state.unlock(),
};
```

A validator's `watch` is a plain list of names: the rule is re-run when one of
those fields' **value** changes.

A list declared with `FieldArray` can be watched like a field: its value is the
array of its rows' values.

## Reading a watched field

Inside a hook or a rule, read a declared field with `ctx.watched(name)`. It
returns the same read-only view, or `null` if that field does not exist yet.

```ts
ctx.watched("postcode")   // ✓ declared
ctx.watched("city")       // ✗ throws: reads "city" without declaring it in `watch`
```

The error is immediate and names the field. How it is recorded today depends on
where it happens (see [Engine errors](engine-errors.md)):

- in a behavior hook: in `form.engineErrors`, as a `hook-error`;
- in a validator that is one of an array of two or more: as a
  `guard-violation`, and the field gets the blocking `"unverified"` issue
  (or another member's refusal);
- in any other validator: it is a rule that throws. If the rule is not `async`,
  the field currently keeps its previous verdict — see
  [the known gap](../model/interrupted-pass.md).

:::caution `ctx.form` is not checked
`ctx.form.field(name)` and `ctx.form.values()` can read **any** field, without
`watch` and without an error — and nothing calls your code again when what you
read changes. Reading a dependency that way gives a result that silently goes
stale. Use `ctx.watched()` for anything you depend on.
:::

## One form, one graph

`watch` only sees the fields of the same form. A field of another form, or —
inside a [row](../model/a-row-is-a-form.md) — a field of the parent form,
cannot be watched.
