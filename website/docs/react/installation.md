---
id: installation
title: Wiring up React
sidebar_position: 1
description: Declare the form in a module, derive typed hooks from it, and write your first field component. No provider required.
---

# Wiring up React

`slz-react-form` is a thin bridge: a provider and a few hooks. It holds no
business logic — that all lives in the core.

```bash
npm install slz-form slz-react-form
```

## The form module

Declare the form and its field map in a module of its own, then derive the
hooks from it:

```ts
// src/form/signup-form.ts
import { FormController } from "slz-form";
import { hooksFor } from "slz-react-form";

export type SignupFields = { email: string; postcode: string; city: string };

export const signupForm = new FormController<SignupFields>({ name: "signup" });

export const { useField, useFieldArray, useForm } = hooksFor(signupForm);
```

The hooks returned by `hooksFor` are bound to that form and typed by its map:
`name` only accepts declared fields, and the value type is inferred. There is
**no provider to mount** and no form to name on each field.

## A field component

```tsx
import { useField } from "./form/signup-form";

function EmailField() {
    const field = useField({
        name: "email",              // ← only names declared in SignupFields compile
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

`EmailValidator` is a validator you write (see [Validate](../guides/validate.md));
`Spinner` is your own component.

**Adding a field to the form means rendering such a component.** The first
render creates the field; mounting the component mounts the field; unmounting
the component unmounts it, which takes its value out of `values()`.

Next:

- the hooks in detail, and what each returns: [Hooks](./hooks.md);
- lists of rows: [Repeatable lists](./lists.md);
- the submit button: [Submit a form](../guides/submit.md#in-react).

## No server rendering, for now

`useField`, `useFieldArray` and `useForm` read their state with
`useSyncExternalStore` **without** a `getServerSnapshot`: `renderToString`
throws `Missing getServerSnapshot`. Render these components on the client only.

A form declared at module level, as above, is **one object per JavaScript
process**. In the browser that is what you want. On a server it would be shared
by every request and every user — another reason to keep forms on the client.
