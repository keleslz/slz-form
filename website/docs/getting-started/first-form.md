---
id: first-form
title: First form
sidebar_position: 3
description: Create a form, add a field with a rule, read its state — then derive typed helpers from the field map.
---

# First form

## The engine, alone

No framework is needed: this code runs as is in a browser, under Node, Deno or
Bun.

```ts
import { FormController, IValidator, type ValidationReport } from "slz-form";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        if (!EMAIL.test(value)) report.error("Invalid email address");
    }
}

const form = new FormController<{ email: string }>({ name: "signup" });

const email = form.field("email", { required: true, validator: new EmailValidator() });

const unsubscribe = email.listen(() => console.log(email.snapshot.flags));
email.mount();
email.change("ada@lovelace.dev");

email.hasFlag("valid");   // true
unsubscribe();
```

What each line does:

- `new FormController<{ email: string }>({ name: "signup" })` creates the form.
  The type argument is the **field map**: it lists the fields and the type of
  each value. `name` identifies the form; it must be unique in your app.
- `form.field("email", params)` creates the field on the first call and returns
  the **same instance** on every later call. `params` are read only on that
  first call.
- `email.listen(callback)` subscribes to the field: the callback runs each time
  its snapshot changes. It returns the function that unsubscribes.
- `email.mount()` puts the field into the form being filled. A field that is not
  mounted is left out of `form.values()` and of the form's
  [verdict](../index.md#vocabulary) — whether it may be sent.
- `email.change(value)` is what an input calls when the user types. It marks the
  field `touched` and runs the validator.
- `email.hasFlag("valid")` reads a flag. It is `true` here because the field was
  touched and the rule accepted the value.

To use this field from plain DOM code, see
[Without a framework](../guides/without-a-framework.md). To send the form, see
[Submit a form](../guides/submit.md).

## The field map, and what it buys you

In an application, declare the form once, in a module of its own that the rest
of the app imports. The ready-made behaviors and the React hooks are derived
from it, so they are typed by the field map:

```ts
// src/form/car-configuration-form.ts
import { behaviorsFor, FormController } from "slz-form";
import { hooksFor } from "slz-react-form";

export type CarFields = {
    brand: string;
    model: string;
    mileage: number;
    licence: File;
};

export const carForm = new FormController<CarFields>({ name: "car-configuration" });

export const { lookup, loadOptions, suggest, prefill, lockWhile, lockUntilValid, hideWhen } =
    behaviorsFor(carForm);
export const { useField, useForm, useFieldArray } = hooksFor(carForm);
```

`CarFields` is a `type`, not an `interface`: only a type alias has the implicit
index signature the engine's `FieldsShape` constraint requires. With an
`interface`, `new FormController<CarFields>` does not compile.

Field names are now checked — including against the type of value a component
handles. In the demo, `NumberField` only accepts number fields:

```tsx
<NumberField name="mileage" label="Mileage" />       // ✓
<NumberField name="brand" label="Brand" />           // ✗ brand is a string: does not compile
<TextField   name="typo" label="Unknown" />          // ✗ unknown field: does not compile
```

The price: adding a field costs one line in the map on top of the one in the
view. In exchange, field names, values and helper callbacks are typed with **no
`as`**. Three places are not typed by the map — two you handle without a cast,
one you avoid for now. `form.values()` is a `Record<string, unknown>`: read a
typed value with `form.get(name)`
([Submit a form](../guides/submit.md#what-you-send-formvalues)). A value read
with `ctx.watched()` is `unknown`: narrow it
([Repeatable fields](../guides/repeatable-fields.md#a-rule-about-the-whole-list)).
And a form taken from the `FormRegister` is currently untyped — a known gap;
until it is fixed, import the form's own module instead
([Hooks](../react/hooks.md#formprovider-and-useformregister)).

## The ready-made behaviors

`behaviorsFor(carForm)` returns seven helpers, all typed by the map. The fields
you list in `watch` are exactly what the callback receives, with their types:

```ts
lookup({
    field: "model",
    watch: ["brand"],
    debounce: 400,
    fetch: ({ brand }) => fetchDefaultModel(brand),   // brand: string | undefined
});
```

| Helper | What it does |
|---|---|
| `prefill({ field, fetch })` | fills the field from an API when it mounts — `loading` and `locked` meanwhile, still untouched afterwards |
| `lookup({ field, watch, debounce, fetch })` | calls an API when a watched field changes (or when the field itself changes, without `watch`) and **writes** the result |
| `loadOptions({ field, watch, on, debounce, fetch })` | loads the field's option list on mount, and again when a watched field changes |
| `suggest({ field, debounce, fetch })` | search field: reloads suggestions as the user types, without locking the field |
| `lockWhile({ watch, when })` | locks the field while `when` returns `true` |
| `hideWhen({ watch, when })` | hides the field (`invisible`) while `when` returns `true` |
| `lockUntilValid({ watch })` | locks the field until every watched field is accepted by its validator |

A few options worth knowing:

- `on` (`loadOptions`): what reloads the list — `"mount"`, `"dependency"`
  (a watched field changed), `"change"` (the user types). Default: `["mount"]`,
  plus `"dependency"` when `watch` is set.
- `resetOnReload` (`loadOptions`, default `true`): clear the field's value when
  a watched field reloads the list.
- `onError` (`loadOptions`): called when loading fails. Without it, a failure
  looks like an empty list.
- `pending` (`lookup`, `loadOptions`, `suggest`): a function that receives the
  behavior's state and returns the flags to show while the call runs, for
  example `pending: (state) => state.loading()`. Default: `loading` + `locked`
  (`suggest`: `loading` only). The exported `openWhilePending` is that
  `loading`-only function.

`prefill` and `lookup` leave the value unchanged if `fetch` fails, and record
nothing: if you need to know, catch inside your `fetch`. The exact signatures
are in the [API reference](/docs/reference/slz-form).

Some of them also exist as plain functions, with their own signatures and no
typing by the map: `lookup(fetcher, params)`, `loadOptions(fetcher, params)`,
`prefill(fetcher)`, `lockWhile(condition, watch)`, `hideWhen(watch, predicate)`.
`suggest` and `lockUntilValid` exist only in `behaviorsFor`. `dependsOn(watch,
effect)` and `createBehavior(definition)` help you write your own. Prefer the
`behaviorsFor` versions.

When no helper fits, you write the behavior by hand:
[Prefill a field](../guides/prefill.md) shows the same need written three ways,
from a full class down to the helper.

## The model in thirty seconds

- **`FormRegister`** — every form of the app, gathered in one place (optional).
  - **`FormController`** — one form: creates its fields, gathers their values,
    gates the submission.
    - **dependency graph** — who watches whom; a cycle is rejected when a field
      is created.
    - **`FieldController`** — one input: its value, interactions, flags and
      validity.
      - **behaviors** — react, and return the flags they want on the field.
      - **validator** — judges the value; the only source of validity.
      - **`FieldSnapshot`** — what the component renders.

## Field names that are not identifiers

A field can be called `first-name`, `2nd-field` or `name with spaces`: the map
accepts any key — except `__proto__`, which corrupts `form.values()` — and the
typing holds.

```ts
const form = new FormController<{ "first-name": string; "2nd-field": number }>({ name: "f" });

form.field("first-name").snapshot.value   // string | undefined
```

Only the way you write a callback changes, because JavaScript cannot
destructure a name that is not an identifier. In a behavior that watches both
fields:

```ts
fetch: async ({ "first-name": firstName, "2nd-field": second }) => { … }   // string | undefined, number | undefined
fetch: async (deps) => deps["first-name"]                                   // string | undefined
```

This, on the other hand, is not valid JavaScript:

```ts
fetch: async ({ first-name }) => …
//                   ~ error TS1005: ',' expected
```

`first-name` reads as `first` minus `name`: it is a syntax error, not a type
error.
