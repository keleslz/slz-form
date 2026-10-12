---
id: lists
title: Repeatable lists
sidebar_position: 3
description: useFieldArray, useFieldOn, and why the list does not publish its rows' flags.
---

# Repeatable lists

A list is declared as `FieldArray<Row>` in the field map. `useFieldArray(name)`
returns its composition; each row is a form in its own right.

```ts
// src/form/invoice-form.ts
import { FormController, type FieldArray } from "slz-form";
import { hooksFor } from "slz-react-form";

export type InvoiceLine = { label: string; qty: number };
type InvoiceFields = { lines: FieldArray<InvoiceLine> };

export const invoiceForm = new FormController<InvoiceFields>({ name: "invoice" });
export const { useFieldArray, useForm } = hooksFor(invoiceForm);
```

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

A row field is wired with `useFieldOn`, by passing it the row's form:

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

`useFieldOn` takes any form: the row's field map is erased at this generic
bridge, so the value type is given by hand — `<string, never>` here (`never`:
this field carries no options meta).

`row.id` is **stable**: it changes neither when another row is removed nor on
reordering. It is a reliable React key, and it is what keeps a move from
breaking declared dependencies.

## Where to read the aggregate state

The aggregate state of a list — its validity, its errors, its work in flight —
is read through `useForm().snapshot.arrays`, **not** through `useFieldArray`.

`useFieldArray` subscribes only to the **composition** of the list (append,
remove, move), so that a keystroke in one row does not re-render the others.
Exposing flags there would make them stale as of the next keystroke — a wrong
state displayed with confidence, which is worse than no state at all.

The why — a row is an identified `FormController`, never indexed — is in
[A row is a form](../model/a-row-is-a-form.md); the engine side, in
[Repeatable fields](../guides/repeatable-fields.md).
