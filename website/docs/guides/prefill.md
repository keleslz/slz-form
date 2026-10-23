---
id: prefill
title: Prefill a field
sidebar_position: 1
description: Fill a field from an API when it mounts — written three ways, from a full behavior class down to the typed helper.
---

# Prefill a field

To fill a field from an API when it appears, attach a **prefill behavior**.
Below is the same need written three ways, from the most explicit to the
shortest. All three behave **exactly** the same.

## 1. A behavior class

You write everything yourself. Useful to see what the engine does, and the
starting point when a behavior goes off the beaten path.

```ts
import { Behavior, FormController, type BehaviorContext, type BehaviorState } from "slz-form";

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
            // it is not an input error, and the validator stays the only judge
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

The field's flags, in order:

```
during the call   pristine, loading, locked
after the call    pristine, idle          ← value set, field still pristine
```

Three things to remember:

- **The field stays `pristine`.** `ctx.setValue` does not mark the field
  touched: a value from an API is not something the user did.
- **`ctx.push` shows `loading` before the `await`.** A hook's return value is
  only applied when the promise resolves; without `push`, `loading` would never
  be visible.
- **`ctx.signal` is aborted when the field unmounts.** Checking it after the
  `await` stops a late response from writing into a field that is gone.

## 2. The same behavior, with a validator

Add a rule. Nothing changes on the behavior side: the behavior **writes** the
value, the validator **judges** it, and they do not get in each other's way.

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
after the prefill   pristine, idle     ← judged, but nothing displayed
the user types      error, idle        ← "Expected format: CUST-42-9013"
they fix it         valid, idle
```

**A prefilled value never shows an error by itself.** The validator does judge
it — `field.snapshot.errors` is filled, and the form's verdict counts it — but
the field stays `pristine` until the user touches it, or until `submit()`
touches every field.

## 3. The typed helper

The common case, in a few lines. `prefill` comes from `behaviorsFor(form)`, so
the field name and the value type are checked against the field map.

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

Same result as the class: `loading` + `locked` during the call, then the value,
field still `pristine`. If `fetch` rejects or resolves `undefined`, the field
stays empty.

What the compiler catches:

```ts
prefill({ field: "reference", fetch: async () => "x" });
//              ~~~~~~~~~~~ '"reference"' is not assignable to '"customerReference"'
```

And on a form declared `{ customerReference: string; mileage: number }`, a
fetch of the wrong type does not compile either:

```ts
prefill({ field: "mileage", fetch: async () => "not a number" });
//                                 ~~~~~~~~~~~~~~~~~~~~~~~~~ 'string' is not
//                                 assignable to 'number'
```

## Good to know

- **`reset()` runs the prefill again.** `field.reset()` and `form.reset()`
  replay `onMount`, so the API is called again and its answer overwrites the
  restored value.
- **Loading a record into a form that is already on screen** is not a prefill:
  write each value with `field.update({ value })`. It does not mark the field
  touched. It does fire the field's `onChange` behaviors.
- **The value lands after the field mounts.** A behavior that reads the value in
  its own `onMount` sees it empty.
