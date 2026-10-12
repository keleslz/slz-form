---
id: first-form
title: First form
sidebar_position: 3
description: Declare the field map, derive the typed helpers, mount a field.
---

# First form

## The engine, alone

No framework required: this code runs as is in a browser, under Node, Deno or
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

email.hasFlag("valid");   // true — change() marked the field touched, the rule judged
```

The map passed to `FormController` declares what each field holds; everything
else is inferred from it — the name passed to `field()`, the value, the
options' meta. A repeated `field()` returns the same instance: the field is
created on the first call.

## The map, and what it buys you

The form is declared once, in its own contextualized module — the counterpart
of a slice. Behaviors and hooks are derived from it, hence fully typed on the
map:

```ts
// src/form/car-configuration-form.ts        (≈ a slice)
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

`CarFields` is a `type`, not an `interface`: only the former carries the
implicit index signature that the engine's `FieldsShape` constraint requires.

There is no longer a form to name on every field, and `name` is checked —
including against the field's **type**:

```tsx
<NumberField name="mileage" label="Mileage" />       // ✓
<NumberField name="brand" label="Brand" />           // ✗ brand is a string, does not compile
<TextField   name="typo" label="Unknown" />          // ✗ unknown field, does not compile
```

That is the accepted price of narrowing: adding a field costs one line in the
map on top of the one in the view. In exchange, **no `as`** in consumer code.

## The ready-made behaviors

`behaviorsFor(carForm)` returns seven helpers, all bound to the map. What a
field watches in `watch` is what the callback receives, narrowed to the map:

```ts
lookup({
    field: "model",
    watch: ["brand"],
    debounce: 400,
    fetch: ({ brand }) => fetchDefaultModel(brand),   // brand: string
});
```

Two lists, and the distinction matters:

| From `behaviorsFor(form)` — typed on the map | Bare exports — the field name is on you |
|---|---|
| `lookup`, `loadOptions`, `suggest`, `prefill`, `lockWhile`, `lockUntilValid`, `hideWhen` | `lookup`, `loadOptions`, `prefill`, `lockWhile`, `hideWhen`, `dependsOn`, `createBehavior` |

`suggest` has no `watch`: it reads no other field. If it only exists through
`behaviorsFor`, it is because the options it produces are typed on its own
field. `lockUntilValid`, for its part, is the only one that reads other
fields — it watches their **validity**, not their value (`on: ["validity"]`).

When the need is out of the ordinary, the same behavior is written by hand:
[the three forms of the same prefill](../guides/prefill.md) show the path
from the fully hand-written class to the three-line utility.

## The model in thirty seconds

```
FormRegister              every form in the app                  (≈ root reducer)
  └── FormController      one form, orchestrates its Fields      (≈ slice)
        ├── DependencyGraph   cross-field reactivity, cycles rejected at wiring time
        └── FieldController   one input: value, interactions, flags, validity
              ├── IBehavior[]     reactions → return a state slice
              ├── IValidator<T>   validity authority
              └── FieldSnapshot   what the component renders
```

## Field names that are not identifiers

A field can be called `Toto-1`, `2-champ` or `champ avec espaces`: the map
accepts any key, and the narrowing holds in full.

```ts
const form = new FormController<{ "Toto-1": string; "2-champ": number }>({ name: "f" });

form.field("Toto-1").snapshot.value   // string | undefined
```

Only the **way you write** the callback changes, because JavaScript cannot
destructure a name that is not an identifier:

```ts
fetch: async ({ "Toto-1": toto1, "2-champ": deux }) => { … }   // string, number
fetch: async (deps) => deps["Toto-1"]                          // string | undefined
```

This, however, is not valid JavaScript:

```ts
fetch: async ({ Toto-1 }) => …
//                  ~ error TS1005: ',' expected
```

`Toto-1` reads as `Toto` minus `1`: it is a syntax error, not a type error —
the compiler fails at parsing before it even looks at the types.
