---
id: prefill
title: Prefill a field
sidebar_position: 1
description: Fetch an initial value on mount while keeping the field untouched.
---

# Prefill a field

This page shows how to fetch a customer reference when a field mounts, lock the input during the request and validate the result. You can write the behavior yourself or use the typed `prefill` helper.

A prefill is a value set by your application before the user enters it. A behavior reacts to field events and can write that field's value. A validator checks the value and reports errors or warnings. Flags are named states, such as `loading`, that your view reads to decide what to display.

## 1. A behavior class, no validator

The class version shows the lifecycle hook and intermediate state explicitly. `BehaviorContext` supplies access to the field; `BehaviorState` describes this behavior's contribution to its activity and availability. `onMount` runs when the field mounts.

```ts
import { Behavior, type BehaviorContext, type BehaviorState } from "slz-form";

class PrefillCustomerReference extends Behavior<string> {
    async onMount(ctx: BehaviorContext<string>): Promise<BehaviorState> {
        ctx.push(ctx.state.loading().lock());
        try {
            const reference = await fetchCustomerReference();
            if (!ctx.signal.aborted) {
                ctx.setValue(reference);
            }
        } catch {
            // a prefill that fails leaves the field empty:
            // validation reports any issue with the field value
        }
        return ctx.state.idle().unlock();
    }
}

const form = new FormController<{ customerReference: string }>({ name: "account" });

const field = form.field("customerReference", {
    behaviors: [new PrefillCustomerReference()],
});
field.mount();
```

With an initially empty, untouched field, the flags change as follows:

```
during the call   pristine, loading, locked
after the call    pristine, idle          ← value set, field still pristine
```

- `ctx.setValue` writes the value and triggers validation without marking the field `touched`. The displayed validity therefore stays `pristine` until interaction.
- `ctx.push` publishes `loading` and `locked` before the `await`, so the view can show a spinner and disable the input while the request runs. Returning a promise from a behavior does not publish these flags by itself.
- `ctx.signal` is aborted on unmount. The check after the `await` avoids a late write; pass the signal to your network call too if you want it to cancel the request.

This catch deliberately ignores a failed prefill. The initially empty field stays empty, and the behavior releases its loading and lock flags. For a field that already had a value, this failure would leave that value in place.

## 2. The same behavior, with a validator

Add a validator to check the fetched reference's format. `ValidationReport` collects the errors and warnings from one validation run.

```ts
class ReferenceValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        report.errorIf(!/^CUST-\d{2}-\d{4}$/.test(value), "Expected format: CUST-42-9013");
    }
}

const field = form.field("customerReference", {
    required: true,
    validator: new ReferenceValidator(),
    behaviors: [new PrefillCustomerReference()],
});
```

The display can follow this sequence when the user enters an invalid reference and then corrects it:

```
after the prefill   pristine, idle     ← validated, but no error displayed yet
the user types      error, idle        ← "Expected format: CUST-42-9013"
they fix it         valid, idle
```

Validation runs on mount and when `ctx.setValue` changes the value. An invalid prefilled value can therefore appear in `field.errors` and block form submission immediately. The untouched field still stays `pristine`, so an error message guarded by `hasFlag("error")` stays hidden.

`change` and `blur` mark the field touched. Submission also touches the mounted fields and validates them. These interactions allow the field to display its validation result. Reading `field.errors` directly gives the blocking messages regardless of display state.

## 3. The typed helper

`behaviorsFor(form)` returns helpers that check names and values against the field map, the type associating each field name with its value. Use its `prefill` helper for this common mount-and-fetch operation:

```ts
const { prefill } = behaviorsFor(form);

const customerReferencePrefill = prefill({
    field: "customerReference",
    fetch: () => fetchCustomerReference(),
});

const field = form.field("customerReference", {
    required: true,
    validator: new ReferenceValidator(),
    behaviors: [customerReferencePrefill],
});
```

The helper publishes `loading` and `locked` while it fetches, writes a returned value and leaves an untouched field `pristine`. It catches a fetch failure and leaves the existing value in place. A return value of `undefined` also leaves the value in place.

TypeScript checks the field name:

```ts
prefill({ field: "reference", fetch: async () => "x" });
//              ~~~~~~~~~~~ '"reference"' is not assignable to '"customerReference"'
```

It also checks the returned value. On a form declaring `{ customerReference: string; mileage: number }`, this fetch has the wrong result type:

```ts
prefill({ field: "mileage", fetch: async () => "not a number" });
//                                 ~~~~~~~~~~~~~~~~~~~~~~~~~ 'string' is not
//                                 assignable to 'number'
```

These errors are caught at compile time when using the typed helper.
