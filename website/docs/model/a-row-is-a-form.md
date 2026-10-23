---
id: a-row-is-a-form
title: A row is a form
sidebar_position: 4
description: Why repeatable fields have no path-based naming, and what that means when you add, move or validate rows.
---

# A row is a form

A repeatable list — invoice lines, contacts, shares — has **no** path-based
names: neither `lines[0].qty` nor `lines.0.qty`. Each **row** is a small
`FormController` of its own, with the same API, the same validation and the
same behaviors as any form.

```ts
type InvoiceFields = { customer: string; lines: FieldArray<{ label: string; qty: number }> };

const form = new FormController<InvoiceFields>({ name: "invoice" });
const lines = form.array("lines");

const id = lines.append();          // a stable id, never an index
const row = lines.row(id);          // null if that row was removed
if (row) {
    const qty = row.field("qty");
    qty.mount();
    qty.change(3);
}

lines.remove(id);
```

The fields of a row are created and mounted like any field: `row.field(name)`,
then `mount()`. In React, `useFieldOn(row.form, …)` does both — see
[Repeatable lists](../react/lists.md).

## What it avoids

Rows are **identified**, never indexed. Removing or moving a row renames
nothing, so no `watch` ever starts pointing at another row.

With index-based names, deleting row 0 turns the old row 1 into the new row 0:
a dependency declared on `lines[1].qty` silently starts watching another row.
The bug does not show when reading the code and is hard to reproduce.

## What it costs

- A row is mounted and unmounted like a form. A row whose fields were never
  mounted contributes `{}` to the payload and blocks nothing.
- A row cannot read its parent form: inside a row, `ctx.form` is the row, and
  `watch` only sees the row's own fields.
- `form.reset()` empties the list — a list starts empty.

In exchange, nothing in the engine was reworked for lists: the field map, the
dependency graph and validation are the ones forms already use.

## A rule about the whole list

"The shares add up to 100" belongs to no single row. It is a validator on a
field of the **parent** form, which declares the list in `watch` and reads it
with `ctx.watched(...)`. The full example is in
[Repeatable fields](../guides/repeatable-fields.md#a-rule-about-the-whole-list).

A list reports its state with the words of a form: `valid` or `error` — never
`pristine`. A list is an aggregate, not a field the user touches, so a row with
an empty required field puts the list in `error` before anyone types.
