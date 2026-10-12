---
id: repeatable-fields
title: Repeatable fields
sidebar_position: 4
description: Add, remove and validate rows — each one being a form.
---

# Repeatable fields

A list is declared with `FieldArray<Row>` in the field map, and driven through
`form.array(name)`. Rows are **identified, never indexed**: adding, moving or
removing renames nothing.

```ts
type InvoiceFields = {
    customer: string;
    lines: FieldArray<{ label: string; qty: number }>;
};

const form = new FormController<InvoiceFields>({ name: "invoice" });
const lines = form.array("lines");

const id = lines.append();          // a stable id, never an index
lines.row(id)?.field("qty").change(3);

lines.move(0, 1);
lines.remove(id);
lines.values();
```

`append()` returns the id of the new row; `row(id)` returns the row, or `null`
if it was removed in the meantime. A row **is** a form — same API, same
validation, same behaviors: `.field("qty")` drives it exactly like a field of
the parent. The why is in
[A row is a form](../model/a-row-is-a-form.md).

## A rule about the whole list

"The sum is 100%" lives in no row: it is a validator of the parent that
watches the list. It sits on a summary field and declares `validateWhenEmpty`,
otherwise it would never run as long as that field is empty.

```ts
type Allocation = {
    parts: FieldArray<{ share: number }>;
    total: number;
};

class SharesMustSumTo100 extends IValidator<number> {
    readonly watch = ["parts"];
    readonly validateWhenEmpty = true;

    protected validate(_total: number | undefined, report: ValidationReport, ctx: ValidationContext): void {
        const rows = ctx.form.values().parts;
        const sum = (Array.isArray(rows) ? rows : []).reduce<number>((acc, row) => acc + shareOf(row), 0);
        report.errorIf(sum !== 100, `the sum is ${sum}, not 100`, { code: "sum" });
    }
}

const allocation = new FormController<Allocation>({ name: "allocation" });
allocation.field("total", { validator: new SharesMustSumTo100() });
```

`ctx.form.values()` is a read view typed `Record<string, unknown>` — the form
opens no subscription on it — so the rows come back raw and you narrow them by
hand, without a single `as`:

```ts
function shareOf(row: unknown): number {
    return typeof row === "object" && row !== null && "share" in row && typeof row.share === "number"
        ? row.share
        : 0;
}
```

## The state of a list

A list answers the same two functions as everything else, and publishes
`valid` · `error` — never `pristine`: it is an aggregate, not a field you
touch.

```ts
lines.ui.hasFlag("error");     // at least one row is rejected
lines.errors;                  // the issues, flattened
lines.ui.hasFlag("loading");   // a row has work in flight
```

On the React side, the same aggregated state is read through
`useForm().snapshot.arrays` — not through `useFieldArray`, which only
subscribes to the **composition** of the list (add, remove, move). The details
of the hooks are in [Lists](../react/lists.md).
