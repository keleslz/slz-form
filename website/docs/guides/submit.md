---
id: submit
title: Submit a form
sidebar_position: 3
description: form.submit() is a gate, not a sender — what it does step by step, what it returns, how to guard the button, and how to show server errors.
---

# Submit a form

`form.submit()` does not send anything. It is a **gate**: it gets the form
ready, judges it, and answers `true` or `false`. Sending is your code, once the
gate opens. The examples on this page use this `signupForm`.

```ts
type SignupFields = { email: string; password: string };

export const signupForm = new FormController<SignupFields>({ name: "signup" });

if (await signupForm.submit()) {
    await fetch("/api/signup", { method: "POST", body: JSON.stringify(signupForm.values()) });
    signupForm.reset();
}
```

## What `submit()` does

In order:

1. **Refuses a second submission.** If one is already running, the call returns
   `false` at once — a double click during the gate returns `false` the second
   time.
2. **Locks the form.** The form's status becomes `submitting`, and every mounted
   field gets the `submitting` and `locked` flags.
3. **Touches every mounted field.** Each one becomes `touched`, so an untouched
   required field now displays its error. Its `onSubmit` hooks run, anything
   waiting on a debounce runs now, and its validator runs again. The rows of
   every list go through the same step.
4. **Waits for work in flight.** A prefill or a lookup still running must land
   before the form is judged, otherwise you would send a value that is not
   there yet. A field whose value changed while waiting is validated again.
   `settleTimeout` (10 seconds by default) bounds step 3 and this wait, each on
   its own — so up to about twice `settleTimeout` in total — but not the
   second validation; see [Settings](#settings).
5. **Judges.** It returns `true` only if everything settled in time and the form
   is `valid`. The status becomes `submitted` on success, `idle` on failure, and
   the fields lose the `submitting` flag and the lock that came with it.

Only **mounted** fields take part. A field hidden by a behavior (`invisible`)
is still validated and can show its errors, but it does not count in the
verdict; and since it is mounted, its value **is** in `form.values()`.

## When it returns `false`

| Cause | What you see |
|---|---|
| a field or a row has a blocking issue | the errors are displayed (every field is touched now); `form.snapshot.errors` lists them by field |
| the work in flight did not finish within `settleTimeout` | the fields that were still `loading` are released; `form.engineErrors` may tell why. A rule that was still running gets its previous verdict back, so the form can look `valid` until the next run — [a known gap](../model/interrupted-pass.md) |
| a submission was already running | nothing changes |

## What you send: `form.values()`

`form.values()` returns the values of every **mounted** field — hidden ones
included — and, for each list, the array of its rows' values. A field that is
not mounted is left out. To leave out a field the user cannot see, unmount it
(in React, stop rendering its component).

The result is typed `Readonly<Record<string, unknown>>`: the field map is not
carried over to it. When you need a typed value, read it from its field:

```ts
const email = signupForm.get("email")?.snapshot.value;   // string | undefined
```

## Which guard for the button

After a successful `submit()`, the status stays `submitted` until
`form.reset()` — editing a field does not bring it back to `idle`. Choose the
guard that matches what happens after a send:

| After a successful send… | Guard |
|---|---|
| you call `form.reset()` (the form starts over) | `disabled={!hasFlag("valid", "idle")}` |
| the form stays on screen (save and keep editing, server errors to show) | `disabled={hasFlag("submitting")}` |
| same, and you also want to block while invalid | `disabled={!hasFlag("valid") \|\| hasFlag("submitting")}` |

`!hasFlag("valid", "idle")` reads "not (valid and idle)": it disables the
button while the form is invalid **or** not idle — sending, or already
`submitted`.

Letting the user click while the form is invalid is a valid choice too:
`submit()` then touches every field, which displays every error at once.

:::note `submitting` covers the gate, not your request
The form is `submitting` only while `submit()` runs. Once it resolves, the
form is `submitted` — including while your own `fetch` is still in flight. If
that request is slow and must not be sent twice, keep track of it yourself.
:::

## In React

`useForm()` gives the same `submit`, `reset` and flags:

```tsx
export const { useField, useForm } = hooksFor(signupForm);

function SubmitButton() {
    const { hasFlag, submit, reset } = useForm();

    const send = async () => {
        if (!(await submit())) {
            return;
        }
        await fetch("/api/signup", { method: "POST", body: JSON.stringify(signupForm.values()) });
        reset();
    };

    return (
        <button type="button" disabled={hasFlag("submitting")} onClick={() => void send()}>
            {hasFlag("submitting") ? "Sending…" : "Sign up"}
        </button>
    );
}
```

Read the values from the form after `submit()` resolves — `signupForm.values()`
— rather than from a value captured during render: a lookup may have written a
value during the submission.

## Errors returned by the server

The gate opened, you sent, and the server answers that the email is taken. Put
an [`ExternalValidator`](validate.md#several-validators-on-one-field) next to
the field's rules ([`EmailValidator`](validate.md#a-rule) is the rule from
Validate) and give it the server's issues. Mount the field: an unmounted field
is neither judged nor sent, and nothing warns you.

```ts
const emailTaken = new ExternalValidator<string>();

const email = signupForm.field("email", { required: true, validator: [new EmailValidator(), emailTaken] });
email.mount();

async function save(): Promise<void> {
    if (!(await signupForm.submit())) {
        return;
    }
    const response = await fetch("/api/signup", { method: "POST", body: JSON.stringify(signupForm.values()) });
    if (response.status === 422) {
        emailTaken.set([{ message: "This email is already registered", severity: "error", code: "taken" }]);
        return;
    }
    signupForm.reset();
}
```

In React, the field is created by `useField`, and only the **first** call that
creates a field reads its parameters. So give the `ExternalValidator` to
`useField` itself, and keep the instance at module level so `save()` can reach
it:

```tsx
const emailTaken = new ExternalValidator<string>();

function EmailField() {
    const field = useField({ name: "email", required: true, validator: [new EmailValidator(), emailTaken] });
    return <input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} />;
}
```

The field shows the error at once, the form becomes `error`, and the issue goes
away as soon as the user edits the email. The form is still `submitted` at this
point, so guard the button with `hasFlag("submitting")`, not with
`hasFlag("valid", "idle")`.

## Starting over: `form.reset()`

`form.reset()` puts every field back to its `initialValue` (or empty), untouched
and `pristine`, runs each field's `onMount` hooks again (so a prefill fetches
again), removes every row of every list, empties `form.engineErrors`, and sets
the status back to `idle`.

## Settings

```ts
new FormController<SignupFields>({ name: "signup", settleTimeout: 5_000 });
```

`settleTimeout` is how long `submit()` waits for work in flight, in
milliseconds. The rows of a list use their parent form's `settleTimeout`.

:::caution A rule that never settles can block `submit()`
`settleTimeout` bounds the first validation and the wait, but not the second
validation of a value that changed during the wait. If a rule's promise never
settles at that point, `submit()` never returns, and the form stays
`submitting` with its fields locked — `reset()` does not unlock them. Give every
network call in a validator a timeout, for example
`fetch(url, { signal: AbortSignal.timeout(5_000) })`.
:::
