---
id: first-form
title: First form
sidebar_position: 3
description: Create a field, validate its value and derive helpers from a typed form declaration.
---

# First form

This page shows how to create and validate a field with the core, then derive typed behaviors and React hooks for a car form. You will also see how field names and value types are checked.

## The engine, alone

`FormController` manages a form and creates its field controllers. A field controller stores one field's value and runs its validation and behaviors. A validator checks the value and reports errors through a `ValidationReport`, which collects the messages from one validation run.

This example uses the core without a UI framework. It can run in a browser or a JavaScript runtime such as Node, Deno or Bun, once the package is available to that environment.

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

email.hasFlag("valid");   // true — change() marked the field touched and validated the value
```

The type passed to `FormController` is the field map: it associates each name with a value type. `field("email", ...)` creates the controller on its first call. Later calls with that name return the same instance; they do not replace its initial configuration.

`listen` subscribes to state changes and returns an unsubscribe function. `mount` starts the field's lifecycle and validates its initial value. `change` records a user interaction and validates the new value. A flag is a named state such as `valid`; `hasFlag` checks whether it is present. A snapshot is the object containing the current value, messages and flags.

## The map, and what it buys you

Keep the form declaration in a module that your components can import. A behavior reacts to events, for example by loading model options after the brand changes. `behaviorsFor` creates helpers with names and values typed from the map. `hooksFor` creates React hooks bound to that same form.

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

Use a `type` alias for `CarFields`. With this object shape, TypeScript supplies the implicit index signature needed by `FieldsShape`, the engine's `Record<string, unknown>` constraint. An equivalent interface does not satisfy that constraint.

The derived hooks already know which form to use. They check the field name and infer its value type. Application components such as `NumberField` and `TextField` must constrain their `name` props to the matching field types for these examples to be checked as shown:

```tsx
<NumberField name="mileage" label="Mileage" />       // ✓
<NumberField name="brand" label="Brand" />           // ✗ brand is a string, does not compile
<TextField   name="typo" label="Unknown" />          // ✗ unknown field, does not compile
```

When you add a field, add its name and type to the map as well as its component to the view. The helpers then infer values and option metadata without requiring casts in the usual typed path. Option metadata is extra data attached to an option, such as a brand logo; declare it with `Field<Value, Meta>` if you need it.

## The ready-made behaviors

`behaviorsFor(carForm)` returns seven helpers. `watch` declares which other fields a behavior observes. Their values are supplied to the callback and can be `undefined` before those fields have a value. `debounce: 400` delays the request until the configured 400 ms waiting period has elapsed.

```ts
lookup({
    field: "model",
    watch: ["brand"],
    debounce: 400,
    fetch: ({ brand }) => fetchDefaultModel(brand),   // brand: string | undefined
});
```

The form-bound helpers and the direct exports have different signatures:

| From `behaviorsFor(form)` — typed from the map | Direct exports — configure names and types yourself |
|---|---|
| `lookup`, `loadOptions`, `suggest`, `prefill`, `lockWhile`, `lockUntilValid`, `hideWhen` | `lookup`, `loadOptions`, `prefill`, `lockWhile`, `hideWhen`, `dependsOn`, `createBehavior` |

`lookup` fetches a value for its field. `loadOptions` fetches its choices. `suggest` reloads choices when the user types in that field; it has no `watch` parameter. `prefill` loads an initial value on mount. `lockWhile` locks the field while a condition holds, and `hideWhen` hides it while a condition holds.

`lockUntilValid` locks while a watched field is missing or has blocking errors. It is the only helper here that watches validity changes (`on: ["validity"]`). Other helpers can watch value changes. A field that is still `pristine`, meaning untouched, can satisfy `lockUntilValid` if it has no errors.

For a custom behavior, see [Prefill a field](../guides/prefill.md), which develops the same example as a class and as a helper.

## The objects involved

`FormRegister` stores named forms so you can retrieve them elsewhere in an application. A `DependencyGraph` records which fields observe which other fields and rejects cycles. `IBehavior` is the contract for event reactions, and `FieldSnapshot` is the state your component reads.

```
FormRegister              forms registered by the application
  └── FormController      one form, orchestrates its Fields
        ├── DependencyGraph   cross-field reactivity, cycles rejected at wiring time
        └── FieldController   one input: value, interactions, flags, validity
              ├── IBehavior[]     reactions → return a state contribution
              ├── IValidator<T>   value checks
              └── FieldSnapshot   what the component renders
```

## Field names that are not identifiers

The field map accepts keys such as `Toto-1`, `2-champ` or `champ avec espaces`. Their value types are inferred in the same way as other keys.

```ts
const form = new FormController<{ "Toto-1": string; "2-champ": number }>({ name: "f" });

form.field("Toto-1").snapshot.value   // string | undefined
```

For destructuring, quote the property name and give it a local variable name. You can also use bracket access:

```ts
fetch: async ({ "Toto-1": toto1, "2-champ": deux }) => { … }   // string | undefined, number | undefined
fetch: async (deps) => deps["Toto-1"]                          // string | undefined
```

Leaving the name unquoted in this destructuring produces a syntax error:

```ts
fetch: async ({ Toto-1 }) => …
//                  ~ error TS1005: ',' expected
```

The parser reads the hyphen as an operator. It fails before TypeScript can check the field's type.
