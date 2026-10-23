---
id: repeatable-fields
title: Repeatable fields
sidebar_position: 5
description: Add, move, remove and validate rows of a list — each row being a small form of its own.
---

# Repeatable fields

A list of rows — invoice lines, contacts — is declared with `FieldArray<Row>`
in the field map, and driven with `form.array(name)`. Rows are **identified,
never indexed**: adding, moving or removing a row renames nothing.

```ts
import { FormController, type FieldArray } from "slz-form";

type InvoiceFields = {
    customer: string;
    lines: FieldArray<{ label: string; qty: number }>;
};

const form = new FormController<InvoiceFields>({ name: "invoice" });
const lines = form.array("lines");

const first = lines.append();       // a stable id, never an index
const second = lines.append();
const qty = lines.row(first)?.field("qty");
qty?.mount();
qty?.change(3);

lines.move(0, 1);                   // reorder by position; ids do not change
lines.remove(second);
lines.values();                     // [{ qty: 3 }] — the mounted fields of each row, in display order
```

| Method | What it does |
|---|---|
| `append()` | adds an empty row and returns its id |
| `row(id)` | the row, or `null` if it was removed |
| `remove(id)` | removes a row: its values leave the payload |
| `move(from, to)` | moves the row at position `from` to position `to` |
| `clear()` | removes every row |
| `rows` | the rows, in display order — each has an `id` and a `form` |
| `values()` | the rows' values, in display order |

A row **is** a form: `row.field("qty")` creates and returns a field exactly like
`form.field(...)` does, and that field must be mounted to count. A new row has
no fields until you create them, so it contributes `{}` to the payload and
blocks nothing. In React, `useFieldOn(row.form, …)` creates and mounts the
field for you — see [Repeatable lists](../react/lists.md). The reasons for this
design are in [A row is a form](../model/a-row-is-a-form.md).

`form.reset()` removes every row: a list starts empty.

## A rule about the whole list

"The shares add up to 100" belongs to no single row. Put a validator on a field
of the **parent** form — here a `total` field — that watches the list:

```ts
type Allocation = {
    parts: FieldArray<{ share: number }>;
    total: number;
};

class SharesMustSumTo100 extends IValidator<number> {
    readonly watch = ["parts"];
    readonly validateWhenEmpty = true;

    protected validate(_total: number | undefined, report: ValidationReport, ctx: ValidationContext): void {
        const rows = ctx.watched("parts")?.value;
        const sum = (Array.isArray(rows) ? rows : []).reduce<number>((acc, row) => acc + shareOf(row), 0);
        report.errorIf(sum !== 100, `the sum is ${sum}, not 100`, { code: "sum" });
    }
}

const allocation = new FormController<Allocation>({ name: "allocation" });
allocation.field("total", { validator: new SharesMustSumTo100() }).mount();
```

- `watch: ["parts"]` re-runs the rule whenever a row's value changes, or a row
  is added, moved or removed.
- `validateWhenEmpty` is required: the rule judges the rows, not the value of
  `total`, which may well be empty.

A watched field's value is typed `unknown`, so you narrow the rows yourself —
without `as`:

```ts
function shareOf(row: unknown): number {
    return typeof row === "object" && row !== null && "share" in row && typeof row.share === "number"
        ? row.share
        : 0;
}
```

Two things to know about the host field:

- it is a real field, so it is part of `form.values()` (here `total`);
- like any field, it displays its error only once touched. Until the user
  touches it or submits, read the message from
  `allocation.snapshot.errors.total`.

## The state of a list

A list answers the same two functions as a field, with the words of a form:
`valid` or `error` — never `pristine`, since nobody "touches" a list.

```ts
lines.ui.hasFlag("error");     // at least one row has a blocking issue
lines.errors;                  // the blocking messages of every row, flattened
lines.ui.hasFlag("loading");   // a row has work in flight
```

In React, read that state from `useForm().snapshot.arrays`, not from
`useFieldArray` — see [Repeatable lists](../react/lists.md#where-to-read-the-state-of-the-list).
