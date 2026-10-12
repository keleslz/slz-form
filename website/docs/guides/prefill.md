---
id: prefill
title: Prefill a field
sidebar_position: 1
description: The same need written three ways, from the full class down to the three-line helper.
---

# Prefill a field

Filling a field from an API on mount, written three ways — from the most
explicit to the shortest. All three produce **exactly** the same behavior.

## 1. A behavior class, no validator

The case where you write everything yourself. Useful to understand what the
engine does, and necessary as soon as a behavior goes off the beaten path.

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
            // it is not an input error, and the Validator remains the only judge
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

What happens, in order:

```
during the call   pristine, loading, locked
after the call    pristine, idle          ← value set, field still pristine
```

Three points are worth remembering:

- **the field stays `pristine`**: `ctx.setValue` does not mark the field as
  touched, because a value that came from an API is not a user interaction;
- **`ctx.push` publishes the wait before the `await`** — without it, `loading`
  would never be visible, since nothing is returned until the promise has
  resolved;
- **`ctx.signal` is aborted on unmount**: that is what stops a late response
  from writing into a field that no longer exists.

## 2. The same behavior, with a validator

We add a rule. Nothing changes on the behavior side: the two do not step on
each other, because they do not act on the same axis — the behavior **writes**
a value, the validator **judges** it.

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

```
after the prefill   pristine, idle     ← the validator has not ruled
the user types      error, idle        ← "Expected format: CUST-42-9013"
they fix it         valid, idle
```

**A prefilled value does not trigger an error.** The field has not been
touched, so it stays `pristine` and displays nothing. The validator only rules
from the first input — or from submission, which touches every field.

## 3. The helper, fully typed

The common case, in three lines. `prefill` comes from `behaviorsFor(form)`, so
everything is inferred from the form's field map.

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

Same behavior as the first example — `loading` + `locked` during the call,
value set, field still `pristine`.

What is checked at compile time:

```ts
prefill({ field: "reference", fetch: async () => "x" });
//              ~~~~~~~~~~~ '"reference"' is not assignable to '"customerReference"'
```

And on a form that declares `{ customerReference: string; mileage: number }`,
a fetch of the wrong type does not compile either:

```ts
prefill({ field: "mileage", fetch: async () => "not a number" });
//                                 ~~~~~~~~~~~~~~~~~~~~~~~~~ 'string' is not
//                                 assignable to 'number'
```

A misspelled field name and a fetch of the wrong type are **compile errors**,
not runtime surprises.
