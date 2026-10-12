---
id: behavior-and-validator
title: Behavior or Validator?
sidebar_position: 2
description: The judge has eyes and a bell; the reactor reacts, it never decides validity.
---

# Behavior or Validator?

The central bet: **nothing you can do with `useState` and a `useEffect` should
be impossible here**, and nothing should force you to modify the engine.

The division of roles is clear-cut. The **behavior** reacts — it writes a value,
publishes options, emits `loading`, `locked`, `readonly`, `invisible`. The
**validator** judges — it is the single authority on validity.

| | Validator | Behavior |
|---|---|---|
| Semantics | "is this value acceptable?" | "what happens when…?" |
| Output | issues: `severity`, `message`, `code` | a state slice: activity, availability |
| Writes the value | no | yes, **its own** |
| Impact on submission | direct — a blocking issue prevents it | indirect — `submit()` waits for its async work |

A simple rule: if the question is "**is it valid?**", it is a validator. If it
is "**what should happen?**", it is a behavior.

## Why the authority is not shared

If a behavior could write validity, you would have to arbitrate between two
sources that disagree — and that trade-off has no right answer. That is what
makes the flags trustworthy: `valid` means a judge has ruled, not that a
component decreed it.

For the separation to hold without making anything impossible, the judge gets
what it needs to work — never what it needs to write. **Eyes**: it declares
`watch` and reads `ctx.watched(...)`. A **bell**: `requestRevalidation()`, which
it rings to re-judge when its verdict can change without the value moving.

| Need | How |
|---|---|
| Confirm a password, order two dates | the validator declares `watch` and reads `ctx.watched(...)` |
| `required` only in some cases | the validator decides, with `validateWhenEmpty` |
| An error returned by the server | `ExternalValidator`, composed with the business rules |
| Re-judge after the fact, with no new keystroke | `requestRevalidation()`, the validator's bell |
| A warning that does not block | `report.warn(...)` |
| Route a message to a snackbar | `report.error(msg, { code })`, and the view reads `code` |
| Lock until another field is valid | `lockUntilValid({ watch })` |
| Invoice lines, dynamic lists | `form.array("lines")` — a row is a form |

This criterion is verified, not asserted: `packages/form/test/parity.test.ts`
takes each case and writes it with a behavior or a validator, **without ever
capturing the `FormController`**. A case that could only be done by capturing
the form would not be covered — it would be worked around.

## A behavior carries no state

It *returns* its state slice; the controller stores it. An instance carries
**configuration** — a URL, a debounce —, never state, otherwise sharing it
between two fields would couple them.

```ts
// ✓ shareable: carries only its configuration, no field state
const prefillFromProfile = prefill(fetchProfileDefault);

form.field("shipTo", { behaviors: [prefillFromProfile] });
form.field("billTo", { behaviors: [prefillFromProfile] });
```

## A field reads, it never writes to its neighbor

A field is the source of truth for itself and for nothing else. Cross-field
locking, hiding and reloading all go through a declared **read**, with no
mutation. See [Declared dependencies](../guides/dependencies.md).
