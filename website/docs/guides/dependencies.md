---
id: dependencies
title: Declared dependencies
sidebar_position: 3
description: React to another field changing its value, validity or loading state.
---

# Declared dependencies

This page shows how to rerun field logic when another field changes. You will be able to choose whether that reaction depends on the other field's value, validity or activity.

A dependency is a field named in `watch` so its changes trigger a reaction. A behavior reacts to field events and can update its own field. A validator checks values and reports errors or warnings. Both can declare dependencies; the form records them in a graph and rejects cycles when fields are registered.

For example, you can lock the city input while the postcode has blocking errors:

```ts
const { lockUntilValid } = behaviorsFor(form);

lockUntilValid({ watch: ["postcode"] });
```

`lockUntilValid` is a helper from `behaviorsFor(form)`. It watches validity and locks if a watched field is unavailable or has errors. It does not require a field to have been touched first.

## Choosing which changes trigger a behavior

For a behavior, a bare field name watches value changes:

```ts
{ watch: ["postcode"] }                                   // ≡ on: ["value"]
```

This default means a postcode revalidation does not by itself reload city options. For other reactions, name the kind of change in `on`:

```ts
{ watch: [{ field: "postcode", on: ["value"] }] }      // default — the value changes
{ watch: [{ field: "postcode", on: ["validity"] }] }   // the verdict — what lockUntilValid does
{ watch: [{ field: "postcode", on: ["activity"] }] }   // loading / idle
```

`value` follows value changes. `validity` follows changes to validation and its displayed state. `activity` follows `loading` and `idle`. These names select the state changes that trigger `onDependencyChanged(ctx, dependency)`.

That hook receives a read-only view of the watched field, including `dependency.value`, `dependency.errors` and `dependency.hasFlag(...)`. A flag is a named state such as `loading`; `hasFlag` checks its presence.

Validators declare field names in `watch` and rerun when those values change. They do not use the behavior's `on` entries.

## Updating the dependent field

The context gives a behavior mutation methods for its own field and read-only views of the others. If a brand change requires new model options, put the loading behavior on the model field: it reads the brand and writes its own options.

Declaring both “model watches brand” and “brand watches model” creates a cycle. The graph rejects it during registration, before it can cause repeated propagation.

## Declaring reads explicitly

Use `ctx.watched` for the fields listed in `watch`:

```ts
ctx.watched("postcode")   // ✓ declared
ctx.watched("city")       // ✗ throws — reads "city" without declaring it in `watch`
```

An undeclared name throws with a message identifying the field and missing declaration. A declared field can still be unavailable; in that case the result is `null`.

`ctx.form` also offers general read-only access, including `values()`. Reading it does not add a dependency or subscribe to changes. Declare the fields in `watch` whenever their changes should rerun your logic.
