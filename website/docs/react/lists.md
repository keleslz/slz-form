---
id: lists
title: Repeatable lists
sidebar_position: 3
description: Render rows with stable keys and connect each input to its row form.
---

# Repeatable lists

This page shows how to render an editable list of invoice lines in React. You will add and remove rows, connect their fields and find the list's combined validation state.

`FieldArray<Row>` declares a list whose rows have the fields described by `Row`. Each row has its own `FormController`, the object that manages fields and runs their configured behaviors and validators. A behavior reacts to field events; a validator checks values and reports messages.

Start by declaring the list in the form's field map, the type associating names with value types:

```ts
// src/form/invoice-form.ts
import { FormController, type FieldArray } from "slz-form";
import { hooksFor } from "slz-react-form";

export type InvoiceLine = { label: string; qty: number };
type InvoiceFields = { lines: FieldArray<InvoiceLine> };

export const invoiceForm = new FormController<InvoiceFields>({ name: "invoice" });
export const { useFieldArray, useForm } = hooksFor(invoiceForm);
```

`useFieldArray("lines")` returns the rows in display order and operations for changing the list:

```tsx
function InvoiceLines() {
    const { rows, append, remove } = useFieldArray("lines");

    return (
        <>
            {rows.map((row) => (
                <fieldset key={row.id}>
                    <LineLabel row={row} />
                    <button onClick={() => remove(row.id)}>Remove</button>
                </fieldset>
            ))}
            <button onClick={append}>Add a row</button>
        </>
    );
}
```

Connect a row field with `useFieldOn`, passing the row's form. `FieldArrayRow` and `useFieldOn` are exported by `slz-form` and `slz-react-form`, respectively:

```tsx
function LineLabel({ row }: { row: FieldArrayRow<InvoiceLine> }) {
    const field = useFieldOn<string, never>(row.form, { name: "label", required: true });

    return (
        <input
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
        />
    );
}
```

`useFieldOn` accepts a form without using its field map to constrain the parameters. Supply the value type explicitly and make sure the name matches a row field: `<string, never>` here. The second type parameter describes metadata attached to options; `never` means this field has none.

`row.id` stays the same when you remove another row or reorder the list. Use it as the React key so the component stays associated with the same row form.

The hook also provides `move(from, to)` and `clear()`. Moving uses positions to change the display order; removing uses the stable identifier.

## Reading the combined state

A snapshot is an object describing current form state. Read the list's validation, blocking errors and loading state through the list entry in `useForm().snapshot.arrays`. Its `ui` provides flags, named states such as `error` and `loading`, which you read with `hasFlag` or `hasAny`.

`useFieldArray` subscribes only to additions, removals and moves. Editing a value in an existing row does not notify that list subscription. Each field has its own subscription, while `useForm` subscribes to the combined form state. This lets a summary react to row errors without requiring the list component to subscribe to every keystroke.

React parent renders and declared dependencies can still update other components. See [Hooks](./hooks.md) for subscription scope, [A row is a form](../model/a-row-is-a-form.md) for the row model, and [Repeatable fields](../guides/repeatable-fields.md) for the core API.
