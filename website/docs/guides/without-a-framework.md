---
id: without-a-framework
title: Without a framework
sidebar_position: 8
description: Drive the engine from plain JavaScript — read a snapshot, subscribe with listen, write with change — and manage the field lifecycle yourself.
---

# Without a framework

The core, `slz-form`, has no framework inside. The React adapter is only a thin
layer over three things every field and form already exposes, and you can use
them directly — from plain DOM code, a web component, or another framework.

| Gesture | On a field | On a form |
|---|---|---|
| **read** the current state | `field.snapshot` (or `field.getSnapshot()`) | `form.snapshot` (or `form.getSnapshot()`) |
| **subscribe** to changes | `field.listen(callback)` → returns `unsubscribe` | `form.listen(callback)` → returns `unsubscribe` |
| **write** | `field.change(value)`, `field.focus()`, `field.blur()` | `form.submit()`, `form.reset()` |

## A complete example

A newsletter form in plain TypeScript and DOM — one email field and a button:

```ts
import { FormController, IValidator, type ValidationReport } from "slz-form";

class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        report.errorIf(!value.includes("@"), "Invalid email address");
    }
}

const form = new FormController<{ email: string }>({ name: "newsletter" });
const email = form.field("email", { required: true, validator: new EmailValidator() });

const input = document.createElement("input");
const message = document.createElement("p");
const button = document.createElement("button");
button.textContent = "Subscribe";
document.body.append(input, message, button);

function renderEmail(): void {
    const snapshot = email.snapshot;
    const value = snapshot.value ?? "";
    if (input.value !== value) {
        input.value = value;
    }
    input.disabled = snapshot.hasFlag("locked");
    message.textContent = snapshot.hasFlag("error") ? (snapshot.error ?? "") : "";
}

function renderForm(): void {
    button.disabled = form.snapshot.hasFlag("submitting");
}

const stopEmail = email.listen(renderEmail);
const stopForm = form.listen(renderForm);

input.addEventListener("input", () => email.change(input.value));
input.addEventListener("focus", () => email.focus());
input.addEventListener("blur", () => email.blur());
button.addEventListener("click", async () => {
    if (await form.submit()) {
        await fetch("/api/newsletter", { method: "POST", body: JSON.stringify(form.values()) });
        form.reset();
    }
});

email.mount();
renderEmail();
renderForm();
```

What to notice:

- **The engine holds the value.** `renderEmail` copies `snapshot.value` into the
  input, because the value can change without the user — a prefill, a lookup,
  `reset()`. The `if` avoids rewriting the input while the user types.
- **`change()` marks the field touched; `blur()` too.** That is what lets the
  error appear: on an untouched field, `error` stays off.
- **The button reads the form, the input reads the field.** Each one
  subscribes only to what it renders.
- **`submitting` only lasts while `submit()` runs.** During the `fetch` that
  follows, the button is enabled again; if a second click must not send twice,
  track the request yourself — see
  [`submitting` covers the gate](submit.md#which-guard-for-the-button).

When the form goes away, unsubscribe and unmount:

```ts
function destroy(): void {
    stopEmail();
    stopForm();
    email.unmount();
}
```

## Subscribing

`listen(callback)` calls `callback` synchronously after every change of the
snapshot, with no argument — read `snapshot` inside it. It returns a function
that unsubscribes.

A snapshot is immutable, and `snapshot` returns **the same object** for as long
as nothing changes. So `previous === field.snapshot` tells you whether anything
changed, and `listen` + `getSnapshot` plug straight into any store that expects
a subscribe/get pair (`useSyncExternalStore` in React, a Svelte readable, a
signal).

Subscribing to a field does not subscribe to the form, and vice versa. A
keystroke in one field only calls that field's listeners, the form's, and those
of the fields that [watch](dependencies.md) it — if their own state changes in
turn.

## The field lifecycle

| Call | When | What it does |
|---|---|---|
| `form.field(name, params)` | once per field | creates the field (later calls return the same field and ignore `params`) |
| `field.mount()` | the input appears | the field joins the form: it counts in `form.values()` and in the verdict, its `onMount` hooks run, its validator runs |
| `field.unmount()` | the input goes away | the field leaves the payload and the verdict; work in flight is cancelled (`ctx.signal` aborts) — except, currently, the wait of a `DebouncedValidator`: its rule still runs once, with the aborted signal (a known gap) |
| `field.reset(value?)` | start the field over | restores `initialValue` — or the `value` you pass —, untouched, and runs `onMount` again |
| `field.update({ … })` | your code changes a setting | see below |

`field.update(changes)` lets your code change, after creation:

| Key | Effect |
|---|---|
| `value` | writes the value **without** marking the field touched (it does fire `onChange` behaviors) |
| `required` | turns the requirement on or off |
| `options` | replaces the option list |
| `locked` / `readOnly` | adds your own lock or read-only state, on top of the behaviors' |

Behaviors and validators are fixed when the field is created; `update()` cannot
replace them.

:::caution Lifecycle traps
- `field.update()` does nothing on a field that is not mounted.
- `field.change()` works before `mount()`, but is **silently ignored** after
  `unmount()`.
- `form.mount()` mounts **every** field created on the form so far — including
  one you unmounted on purpose, which comes back into the payload. Mount fields
  one by one if some of them come and go.
:::

## Reading state

On a field's snapshot:

| Read | Gives |
|---|---|
| `value` | the current value |
| `hasFlag(...)` / `hasAny(...)` | the [flags](../model/flags.md) |
| `flags` | every flag, as an array — handy for debugging |
| `errors` / `error` / `warnings` / `issues` | the validator's messages — see [Validate](validate.md#issues-severity-and-code) |
| `options` | the option list, for a select or a radio group |

`field.hasFlag(...)` and `field.hasAny(...)` also exist directly on the field,
as a shortcut for `field.snapshot.hasFlag(...)`.

On the form's snapshot: `hasFlag(...)` / `hasAny(...)` with the form's flags,
`values` (same as `form.values()`), `errors` (blocking messages by field name),
`flags`, `status`.

## Lists

A [repeatable list](repeatable-fields.md) uses the same three gestures.
`form.array(name)` returns the list. `rows` lists its rows (each with an `id`
and a `form`); `append()`, `remove(id)`, `move(from, to)` and `clear()` change
them; `listen` / `getSnapshot` follow those changes:

```ts
import { FormController, type FieldArray } from "slz-form";

const invoiceForm = new FormController<{ lines: FieldArray<{ label: string; qty: number }> }>({ name: "invoice" });
const lines = invoiceForm.array("lines");

lines.listen(() => console.log(lines.rows.map((row) => row.id)));

const id = lines.append();
const qty = lines.row(id)?.field("qty");
qty?.mount();
```

- `lines.listen(callback)` is called when rows are added, removed or moved —
  not when a value inside a row changes.
- The fields of each row are created and mounted one by one, like any field,
  and each has its own `listen`.
- The state of the list — `lines.ui.hasFlag("error")`, `lines.errors` — changes
  with its rows' values: follow it with `form.listen`.

## Other frameworks

An adapter for Angular, Vue or anything else comes down to four steps: create
the field when the component is created, call `mount()` / `unmount()` with the
component's lifecycle, feed `listen` / `getSnapshot` to the framework's
reactivity, and call `change` / `blur` / `focus` from the input's events. The
React adapter, `slz-react-form`, is a working example in a few hundred lines.
