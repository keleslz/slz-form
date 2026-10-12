---
id: installation
title: Wiring up React
sidebar_position: 1
description: A form module, derived hooks, no mandatory provider.
---

# Wiring up React

The adapter is **a provider and three hooks**. No business logic: it lives
entirely in the core.

```bash
npm install slz-form slz-react-form
```

## The form module

Declare the form and its field map in a module, then derive its hooks from it —
the same split as a slice:

```ts
// src/form/signup-form.ts
import { FormController } from "slz-form";
import { hooksFor } from "slz-react-form";

export type SignupFields = { email: string; postcode: string; city: string };

export const signupForm = new FormController<SignupFields>({ name: "signup" });

export const { useField, useFieldArray, useForm } = hooksFor(signupForm);
```

`name` is then constrained to the declared fields, and the value is inferred.
There is **no provider to mount and no form to name** on each field.

`FormProvider` and `useFormRegister` exist for cross-cutting access to the
`FormRegister` — useful when a very distant component must reach a form —, not
for the common case.

## A field

```tsx
function EmailField() {
    const field = useField({
        name: "email",              // ← constrained to SignupFields
        required: true,
        validator: new EmailValidator(),
    });

    if (field.hasFlag("invisible")) return null;

    return (
        <>
            <input
                value={field.value ?? ""}
                disabled={field.hasFlag("locked")}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
            />
            {field.hasFlag("loading") && <Spinner />}
            {field.hasFlag("error") && <p>{field.error}</p>}
            {field.warnings.map((warning) => <small key={warning}>{warning}</small>)}
        </>
    );
}
```

**Adding a field to the form means mounting this component.** Nothing to declare
upfront.

The two read functions — `hasFlag` / `hasAny` — and render isolation are
detailed in [Hooks](./hooks.md); lists, in
[Repeatable lists](./lists.md).

## No server rendering, for now

`useField`, `useFieldArray` and `useForm` read their state through
`useSyncExternalStore` **without** `getServerSnapshot`: a `renderToString`
throws `Missing getServerSnapshot`. Mount on the client only.
