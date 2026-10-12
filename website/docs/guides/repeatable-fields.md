---
id: repeatable-fields
title: Repeatable fields
sidebar_position: 4
description: Add, move and remove rows, then validate the values of a whole list.
---

# Repeatable fields

This page shows how to add, move and remove invoice lines with the core. You will also write a rule that checks all rows together and read the list's validation and loading state.

`FieldArray<Row>` declares a list in the field map, the type that associates form field names with their values. `Row` declares the fields on each row. `form.array(name)` returns the controller used to manage that list.

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

`append()` returns a stable row identifier. `row(id)` returns a `FieldArrayRow`, or `null` if the row is no longer present. That object contains its stable `id` and its `FormController` in `form`. A `FormController` manages fields and their rules. The row's `.field("qty")` delegates to that form to create or retrieve its quantity field.

`move(from, to)` uses positions to reorder rows; the row identifiers stay unchanged. `remove(id)` removes a row by identifier, and `values()` reads the row values in their current order. The example's move only changes the order when both positions exist.

Create and mount the row fields to include them in validation and values. The React field hooks handle mounting for you. See [A row is a form](../model/a-row-is-a-form.md) for the lifecycle and dependency model.

## A rule for the whole list

A validator checks a value and reports issues, messages with severity `error` or `warning`. To check that all allocation shares total 100, attach a validator to a summary field on the parent and have it watch the list. `watch` lists dependencies whose value changes rerun the rule.

`validateWhenEmpty` enables the rule even when the summary field is empty. Its own value is not needed for this calculation:

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

`ctx.form.values()` returns a read-only `Record<string, unknown>`. It reads current values without subscribing to changes; the declared `watch` triggers revalidation. Check the type of each row before using its properties, for example with this function:

```ts
function shareOf(row: unknown): number {
    return typeof row === "object" && row !== null && "share" in row && typeof row.share === "number"
        ? row.share
        : 0;
}
```

## The state of a list

A flag is a named state checked with `hasFlag` or `hasAny`. A list's `ui` combines its rows' state: `valid` if they have no blocking errors, `error` otherwise, and `loading` while a row has waiting work. It has no `pristine` validity state, even if nobody has interacted with the rows.

```ts
lines.ui.hasFlag("error");     // at least one row is rejected
lines.errors;                  // the issues, flattened
lines.ui.hasFlag("loading");   // a row has work in flight
```

`lines.errors` contains the blocking messages from all rows in one array. It can include errors from untouched fields, even though those fields keep their own displayed validity at `pristine` until interaction.

In React, read this combined state through `useForm().snapshot.arrays`. A snapshot is the object describing current form state. `useFieldArray` subscribes to row additions, removals and moves; it does not subscribe to row contents or flags. See [Repeatable lists](../react/lists.md).
