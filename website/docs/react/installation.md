---
id: installation
title: Wiring up React
sidebar_position: 1
description: Connect a form to React hooks and render its field state.
---

# Wiring up React

This page shows how to connect a form to React and render a validated input. You will create hooks bound to a form and wire an input's change and blur events to its field controller.

`slz-react-form` connects the core's controllers to React subscriptions and lifecycle effects. A controller stores form or field state and runs its configured rules. Your components choose the markup and styles.

```bash
npm install slz-form slz-react-form
```

The adapter requires React ≥ 18. For pre-release setup and the local demo, see [Installation](../getting-started/installation.md).

## The form module

The field map is the type associating each field name with its value type. Declare it with the form in a module, then call `hooksFor` to create hooks for that form:

```ts
// src/form/signup-form.ts
import { FormController } from "slz-form";
import { hooksFor } from "slz-react-form";

export type SignupFields = { email: string; postcode: string; city: string };

export const signupForm = new FormController<SignupFields>({ name: "signup" });

export const { useField, useFieldArray, useForm } = hooksFor(signupForm);
```

The derived `useField` checks that `name` belongs to `SignupFields` and infers the value type. It already knows which form to use, so these hooks work without a provider.

`FormRegister` stores forms by name for access elsewhere in an application. If distant components need that register, `FormProvider` makes it available through React context, and `useFormRegister` retrieves it. This is optional for hooks created with `hooksFor`.

## A field

`useField` creates or retrieves the field controller and mounts it in an effect. A validator checks its value and reports errors or warnings; define `EmailValidator` as in [First form](../getting-started/first-form.md). `Spinner` is a component supplied by your application.

A flag is a named state such as `locked` or `loading`. Read flags with `hasFlag` to decide how the input and messages should render:

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

The field name must first exist in the TypeScript map. The controller is created on the first `useField` call for that name and mounted by the hook's effect; the map itself creates no runtime fields. Unmounting the component unmounts the field.

The validator, behaviors and initial configuration are read when the controller is created. Recreating a validator in a render does not replace the existing controller's validator. Use the hook's supported update props, such as `required`, `locked` and `readOnly`, for settings that change with the view.

See [Hooks](./hooks.md) for subscriptions and state reads, and [Repeatable lists](./lists.md) for rows.

## Client rendering

`useField`, `useFieldArray` and `useForm` call `useSyncExternalStore` without `getServerSnapshot`. Server rendering with `renderToString` throws `Missing getServerSnapshot`. Mount components using these hooks on the client.
