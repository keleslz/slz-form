---
id: a-row-is-a-form
title: A row is a form
sidebar_position: 4
description: Why repeatable fields have no path-based naming.
---

# A row is a form

Repeatable fields have **no** path-based naming — neither `lines[0].qty` nor
`lines.0.qty`. A row **is** a `FormController`: same API, same validation, same
behaviors.

```ts
type InvoiceFields = { customer: string; lines: FieldArray<{ label: string; qty: number }> };

const lines = form.array("lines");
const id = lines.append();

const row = lines.row(id);          // `null` if the row has been removed
const qty = row!.field("qty");
qty.mount();
qty.change(3);

lines.remove(id);
```

## What it avoids

Rows are **identified**, never indexed. Removing or moving a row therefore
renames nothing, and no `watch` ever starts pointing into the void.

With index-based naming, deleting row 0 turns the former row 1 into the new
row 0: any dependency declared on `lines[1].qty` silently observes another row.
The bug is invisible when reading the code and painful to reproduce.

## The accepted price

A row is mounted and unmounted like a form. In exchange, nothing was reworked
to accommodate them — not `FieldsShape`, not `FieldNameOf`, not the dependency
graph.

## A rule that applies to the whole

It is declared on the **parent**, not on the row:

```ts
class SharesMakeAHundred extends IValidator<string> {
    readonly watch = ["parts"];
    readonly validateWhenEmpty = true;
    protected validate(_value, report, ctx) {
        const parts = ctx.form.values().parts;
        const sum = Array.isArray(parts)
            ? parts.reduce((total, part) => total + Number(part.share), 0)
            : 0;
        report.errorIf(sum !== 100, `the sum is ${sum}, not 100`, { code: "sum" });
    }
}
```

`validateWhenEmpty` is required: rules do not run on an empty value, and this
rule does not judge the value of the field carrying it but the sum of the rows.

The validity of a list follows the same logic as the form's: `valid` · `error`,
never `pristine`. A list is an aggregate, not a field you touch.
