---
id: lists
title: Repeatable lists
sidebar_position: 3
description: Render a list of rows with useFieldArray, wire each row's fields with useFieldOn, and read the list's state from useForm.
---

# Repeatable lists

A list is declared as `FieldArray<Row>` in the field map. `useFieldArray(name)`
gives you its rows; each row is a small form of its own, with its own fields.

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

`useFieldArray("lines")` only accepts names declared as `FieldArray` in the
map. It returns `rows` (in display order) and `append()`, `remove(id)`,
`move(from, to)`, `clear()`.

## The fields of a row

A row's field is wired with `useFieldOn`, giving it the row's form:

```tsx
import type { FieldArrayRow } from "slz-form";
import { useFieldOn } from "slz-react-form";

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

`useFieldOn` accepts any form, so it cannot check `name` against the row's map:
you give the value type yourself — `<string, never>` here, where `never` means
the field's options carry no extra data. It returns exactly what `useField`
returns.

`row.id` is **stable**: it does not change when another row is removed or when
rows are reordered. Use it as the React `key`, so each row component keeps its
own state when rows move.

A row contributes to the payload only through its mounted fields: a row whose
components render no field adds `{}` and blocks nothing.

## Where to read the state of the list

The state of a list — its verdict, its errors, its work in flight — is read
from `useForm().snapshot.arrays`, **not** from `useFieldArray`:

```tsx
function LinesStatus() {
    const { snapshot } = useForm();
    const linesSummary = snapshot.arrays.find((list) => list.name === "lines");
    return <p>{linesSummary?.ui.hasFlag("error") ? "A line is incomplete" : null}</p>;
}
```

`useFieldArray` re-renders only when rows are added, removed or moved, so that
typing in one row does not re-render the others. If it exposed the list's
flags, they would be out of date after the next keystroke.

The reasons a row is a form are in [A row is a form](../model/a-row-is-a-form.md);
the engine side is in [Repeatable fields](../guides/repeatable-fields.md).
