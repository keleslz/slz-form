---
id: a-row-is-a-form
title: A row is a form
sidebar_position: 4
description: Use stable row identifiers and reuse form validation for repeatable fields.
---

# A row is a form

This page explains how repeatable rows are represented and where to put rules that apply to a whole list. You will see how row identifiers let fields keep their names when rows move.

Each row has a `FormController`, the object that manages its fields, validation and behaviors. A behavior reacts to field events; a validator checks values and reports errors or warnings. Rows use those APIs in the same way as any other form.

The list is declared with `FieldArray<Row>`, which associates a list field with the row's field types. You access a row by its identifier and then access its fields by name:

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

## Stable identifiers

Each row has an identifier that stays the same when you remove or reorder other rows. Field names such as `qty` are local to that row's form. You do not need paths such as `lines[0].qty` or `lines.0.qty`.

For example, deleting the first invoice line does not rename the quantity field on the next line. A dependency declared within that row still refers to the same field. `watch` is the list of fields whose changes trigger a behavior or validator; the row's form manages its own dependencies.

## Row lifecycle

Row fields need to be created and mounted, just like fields in another form. Removing a row unmounts its form and fields. The React hooks handle field mounting and unmounting for you; when using the core directly, manage that lifecycle in your application.

The engine uses the same field types and dependency graph for parent forms and row forms. See [Repeatable fields](../guides/repeatable-fields.md) for list operations.

## A rule for the whole list

A rule such as “the shares must add up to 100” belongs on a field in the parent form. It watches the list and reads all row values:

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

The field carrying this validator may be empty because its own value is not used in the calculation. `validateWhenEmpty` tells the validator to run its custom rule even on an empty value. Declare it for rules like this; otherwise the custom check is skipped on that value.

`ctx.form.values()` reads the current values. It does not establish a subscription; `watch = ["parts"]` is what reruns the rule when the list values change. The example focuses on the calculation; add parameter types and narrow unknown row values as shown in [Repeatable fields](../guides/repeatable-fields.md).

The list's validity is based on its rows' blocking errors. It publishes the flags `valid` or `error`, including before a user interacts with a row. A flag is a named state read with `hasFlag` or `hasAny`. The list has no `pristine` validity state.
