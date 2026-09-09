<div align="center">

# slz-form

**slz-form is a TypeScript-first, framework-agnostic form engine.**
Declare your fields, behaviors, and validation rules, and let the engine own
the state, the UI states, and the interactions between fields.

[Documentation](https://keleslz.github.io/slz-form-event/) ·
[The model](https://keleslz.github.io/slz-form-event/conception/MODEL) ·
[Live demo](./examples/react)

</div>

> **Pre-release.** The packages build and pass their tests, but nothing is on
> npm yet and the API may still move.

---

A form is rarely hard because of its values. It is hard because of everything
around them: a field is `disabled` while a request is in flight, another is
hidden until a checkbox is ticked, an error must show *after* the user leaves
the field but not on a prefill, a submit button greys out while the form is
invalid or submitting. In most libraries that logic ends up scattered across the
view as ad-hoc booleans:

```tsx
// Recomposed by hand, in every field, forever:
<input disabled={loading || submitting || !brand || readOnly} />
{showError && touched && <p>{error}</p>}
```

slz-form moves all of it into the engine. **What a field *is* is read as flags;
what it *contains* is read as data.** The component decides nothing — it reads a
state and renders:

```tsx
if (field.hasFlag("invisible")) return null;

<input disabled={field.hasFlag("locked")} readOnly={field.hasFlag("readonly")} />
{field.hasFlag("loading") && <Spinner />}
{field.hasFlag("error") && <p>{field.error}</p>}
```

Two functions read every state, at the field and at the form: `hasFlag(...)` is
the **AND** (all present), `hasAny(...)` is the **OR** (at least one). That is
the whole read surface — and it is what deletes the `loading || submitting ||
!brand` soup above.

```tsx
<button disabled={!form.hasFlag("valid", "idle")}>Submit</button>
```

## Table of contents

- [Installation](#installation)
- [Requirements](#requirements)
- [Basic usage](#basic-usage)
- [The model: flags, and two functions](#the-model-flags-and-two-functions)
- [Reading state](#reading-state)
- [Behaviors — reacting](#behaviors--reacting)
- [Validators — judging](#validators--judging)
- [Cross-field dependencies](#cross-field-dependencies)
- [Repeatable fields](#repeatable-fields)
- [Submission](#submission)
- [Engine errors](#engine-errors)
- [React](#react)
- [Any framework, or none](#any-framework-or-none)
- [How it compares](#how-it-compares)
- [What it is not](#what-it-is-not)
- [Ecosystem](#ecosystem)
- [License](#license)

## Installation

```bash
npm install slz-form            # the framework-agnostic engine
npm install slz-react-form      # the React adapter (optional)
```

`slz-form` has **zero runtime dependencies**. `slz-react-form` declares `react`
and `react-dom` as peers.

## Requirements

- **TypeScript with `strict: true`.** The narrowing is the point: a field name
  is constrained to your field map, its value is inferred, and a typo does not
  compile. Without `strict`, those guarantees quietly weaken.
- No bundler or framework requirement for the core. Any JavaScript host works —
  it only uses `setTimeout`, `AbortController`, and `Date.now`.

## Basic usage

The engine is framework-free. You declare a field map, create fields on it, read
their state, and gate submission — no React in sight:

```ts
import { FormController, IValidator, type ValidationReport } from "slz-form";

// The map declares what each field is worth. This is where narrowing comes from.
type SignupFields = { email: string; password: string };

const form = new FormController<SignupFields>({ name: "signup" });

// A validator is the single authority on validity. Extend IValidator and report.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        if (!EMAIL.test(value)) report.error("Invalid email address");
    }
}

const email = form.field("email", { required: true, validator: new EmailValidator() });
const password = form.field("password", { required: true });

form.mount();
email.mount();
password.mount();

email.change("ada@example.com");
password.change("hunter2");

if (await form.submit()) {
    await fetch("/api/signup", { method: "POST", body: JSON.stringify(form.values()) });
}
```

`form.field(name, params)` returns the field controller; `field.change(v)`,
`field.focus()`, `field.blur()` drive it; `field.snapshot` reads it (`.value`,
`.errors`, `.hasFlag(...)`). Everything below is the same engine, seen from
different angles.

## The model: flags, and two functions

This is the structural decision the rest follows from. A naive `Set` of state
booleans lets impossible states coexist — a field both `pristine` **and**
`error`. slz-form splits flags into **two natures**:

- **exclusive** groups — one value at a time; writing one clears the other;
- **cumulative** groups — a set where the union wins (a single `lock()` locks),
  and absence means default.

That is what gives *removing* a flag a precise meaning: you **replace** within an
exclusive group, you **stop emitting** among the cumulative ones — and the UI
follows mechanically, with no component touched.

```ts
field.hasFlag("loading", "invisible")   // AND — all present
field.hasAny("locked", "readonly")      // OR  — at least one
```

There are **no derived state booleans** anywhere in the read surface — no
`isVisible`, no `isLoading`, no `showError`. A need for `isX` never signals a
missing accessor; it signals a missing flag, or a badly chosen word.

## Reading state

The vocabulary, and who is allowed to emit each flag:

| Flag | Nature | Emitted by | Meaning |
|---|---|---|---|
| `pristine` · `valid` · `error` | exclusive | the **Validator**, alone | displayed validity — `pristine` until touched |
| `idle` · `loading` | exclusive | Behaviors + Validator | work is in flight |
| `locked` | cumulative | Behaviors + Controller + view | greyed out, not editable |
| `readonly` | cumulative | Behaviors + Controller + view | readable, selectable, not modifiable |
| `invisible` | cumulative | Behaviors | not rendered — out of validity, still in the payload while mounted |
| `required` · `touched` · `focused` · `mounted` · `submitting` | cumulative | the Controller | interaction and lifecycle |
| *your application's* | cumulative | Behaviors — `ctx.state.mark("skeleton")` | your own words |

The form answers the same two functions with the same words: `valid` · `error`
(the verdict), `idle` · `submitting` · `submitted`, `loading`, `touched`.

One structural nuance, and the source of most confusion: at the **field**,
`error` is what you **display** — it stays off until the field is touched, so a
prefill lights nothing. At the **form**, `error` is what is **true** — a
prefilled, invalid form does not submit. The verdict of a field taken in
isolation is `errors.length > 0`.

Your application extends the vocabulary without touching the engine — a behavior
publishes `mark("skeleton")`, the view reads `hasFlag("skeleton")`, and the
engine never had to learn the word. The engine's own words are refused on that
path: `mark("error")` throws.

## Behaviors — reacting

A **behavior** *reacts*. It writes its field's value, publishes options, and
emits activity (`loading`) and availability (`locked` / `readonly` /
`invisible`). It never decides validity. Several behaviors can share one field,
each keeping its own slice of state.

`behaviorsFor(form)` returns a set of ready-made, fully-typed helpers bound to
your field map — the names below are all narrowed to your fields:

```ts
import { behaviorsFor } from "slz-form";

const { prefill, loadOptions, lookup, suggest, lockWhile, hideWhen } = behaviorsFor(form);

// Fill a field from an API on mount, locked and `loading` meanwhile:
const brandPrefill = prefill({ field: "brand", fetch: () => fetchDefaultBrand() });

// Lock one field while another is not yet consented — cross-field, read-only:
const lockedUntilConsent = lockWhile({
    watch: ["consent"],
    when: ({ consent }) => consent !== true,
});

// Emit `invisible` (display-only) until a value is chosen:
const onlyWhenOther = hideWhen({
    watch: ["brand"],
    when: ({ brand }) => brand !== "other",
});

form.field("otherBrand", { behaviors: [onlyWhenOther] });
```

When no helper fits, a behavior is just an object — the full lifecycle is
`onMount` / `onChange` / `onDependencyChanged` / `onBlur` / `onFocus` /
`onSubmit` / `onUnmount`, each receiving a `ctx`:

```ts
import type { IBehavior } from "slz-form";

const greetOnMount: IBehavior<string> = {
    onMount: (ctx) => ctx.setValue("hello"),
};
```

## Validators — judging

A **validator** *judges*. It is the single authority on validity — no behavior
can contradict it, so there is never an arbitration between two disagreeing
sources. You extend `IValidator<T>` and report findings, each carrying a
`code` and a `severity`:

```ts
import { IValidator, type ValidationReport } from "slz-form";

class UsernameValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        if (value.length < 3) report.error("At least 3 characters");
        if (value.includes(" ")) report.error("No spaces allowed");
    }
}
```

Validators compose (pass an array — their findings are aggregated) and can be
wrapped:

```ts
import { DebouncedValidator, ExternalValidator } from "slz-form";

// Debounce an expensive rule while typing:
new DebouncedValidator(new UsernameValidator(), 400);

// Ask a server, and re-judge without the value changing (ExternalValidator).
```

Rules do not run on an empty value (that is what `required` is for), unless the
validator opts in.

## Cross-field dependencies

A validator or behavior that reads other fields declares them in `watch` — and
only then is it re-run when they change. Reading an undeclared field throws, so
a dependency can never be silent:

```ts
import { IValidator, type ValidationReport, type ValidationContext } from "slz-form";

class ConfirmPasswordValidator extends IValidator<string> {
    watch = ["password"];
    protected validate(value: string, report: ValidationReport, ctx: ValidationContext): void {
        if (value !== ctx.watched("password")?.value) report.error("Passwords do not match");
    }
}
```

Dependencies are wired into a graph that rejects cycles at construction, so a
change propagates through the whole chain — `a → b → c` — and never loops.

## Repeatable fields

A repeatable list has **no path-based naming**. Each row *is* a full
`FormController`, identified and never indexed — so removing or moving a row
renames nothing, and no `watch` ever starts pointing into the void.

```ts
type OrderFields = { lines: FieldArray<{ product: string; qty: number }> };

const form = new FormController<OrderFields>({ name: "order" });
const lines = form.array("lines");

const id = lines.append();          // returns a stable row id
lines.row(id)?.form.field("qty").change(2);
lines.move(0, 1);
lines.remove(id);

lines.values();                      // readonly array of row payloads
```

## Submission

`form.submit()` is a **gate, not a sender**. It returns `Promise<boolean>` and,
in order: touches every mounted field (so pristine required-empty fields now
show their error), fires `onSubmit` behaviors and flushes debounced windows,
waits for async work to converge (bounded by `settleTimeout`), revalidates, and
returns `true` only if the form is settled and valid.

```ts
if (await form.submit()) {
    // The form is valid and everything settled — now YOU send it.
    await api.save(form.values());
    form.reset();
} else {
    // Invalid (errors are already on screen) or it did not converge in time.
}
```

Keep the two reads distinct: `form.hasFlag("valid", "idle")` is the passive
"is it ready right now?" for a disabled button; `await form.submit()` is the
active "make it ready, then judge." The actual network call is your code, after
the gate opens — the engine never sends anything.

## Engine errors

When the **code** of a behavior or a rule *throws* — an async hook rejects, an
engine guard is violated, a rule crashes — the engine catches it, recovers, and
records it. It **never logs to the console**: that is the consumer's call, not
the engine's.

You read those records off the form, when you have a reason to (after a rejected
submit, in a debug panel, in a test):

```ts
if (!(await form.submit())) {
    for (const err of form.engineErrors) {
        // { scope, kind: "hook-error" | "guard-violation", field, error, at }
        reportToSentry(err);
    }
}
```

This is a **pull** surface — an accessor, not a subscription. An engine error is
a crash the engine already recovered from: a diagnostic record, not a live event
to handle in real time. The buffer is bounded to the most recent entries and
cleared by `reset()`.

> This is **not** how you read validation errors. A field that fails its rules
> is not an engine error — read it with `field.errors`, `field.issues`, or
> `field.hasFlag("error")`. `engineErrors` is only for when the code itself
> throws.

## React

`slz-react-form` is a thin bridge — a provider and hooks, zero business rules.
`hooksFor(form)` returns hooks already bound to your field map:

```tsx
import { hooksFor } from "slz-react-form";

const { useField, useForm } = hooksFor(form);

function EmailField() {
    const { value, error, hasFlag, onChange, onBlur } = useField({
        name: "email",
        required: true,
        validator: new EmailValidator(),
    });

    return (
        <label>
            <input
                value={value ?? ""}
                disabled={hasFlag("locked")}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
            />
            {hasFlag("error") && <p>{error}</p>}
        </label>
    );
}

function SubmitButton() {
    const { hasFlag, submit } = useForm();
    return (
        <button disabled={!hasFlag("valid", "idle")} onClick={() => submit()}>
            Submit
        </button>
    );
}
```

`useField` subscribes to that one field, `useForm` to the whole form — both via
`useSyncExternalStore`, so a field that changes never re-renders its neighbors
unless they asked. Repeatable lists get `useFieldArray`, whose `rows` each carry
a sub-form.

## Any framework, or none

The core is framework-free; the React adapter is only a wrapper over two methods
the controllers already expose — `listen` (subscribe) and `getSnapshot` (read).
In plain JavaScript you make the same three gestures by hand:

```ts
const render = () => {
    const s = field.snapshot;                 // read
    input.disabled = s.hasFlag("locked");
    errorEl.textContent = s.hasFlag("error") ? s.errors[0] ?? "" : "";
};
const stop = field.listen(render);            // subscribe → returns an unsubscribe
input.addEventListener("input", () => field.change(input.value));   // write
```

Angular and Vue adapters will follow the same contract.

## How it compares

Different libraries make different bets. slz-form's bet is a framework-agnostic
core where UI state is a flag model with a single source of validity.

| | slz-form | react-hook-form | Formik | TanStack Form |
|---|---|---|---|---|
| Framework | agnostic core + adapters | React | React | React/Vue/… adapters |
| UI state | **flags** (`hasFlag`/`hasAny`), no derived booleans | booleans + `formState` | booleans in state | booleans in state |
| Validity authority | the Validator, **alone** | resolver/schema | validate fn/schema | validators/schema |
| Cross-field reactions | declared `watch` + behaviors | `watch()` / deps | manual | `listeners` / deps |
| Repeatable rows | each row is a **sub-form**, id-based | index-based arrays | index-based arrays | index-based arrays |
| Async/lock/loading | first-class flags | manual | manual | manual |

This is a comparison of philosophies, not a scoreboard — the React libraries are
excellent at what they do.

## What it is not

- **Not a UI kit.** It ships no components, no styling, no labels. It carries
  `code` and `severity`; where and how to display is entirely the view's call.
- **Not a schema library.** Validators are code, not a DSL. You can wrap a schema
  library inside a validator if you want one.
- **Not React-only.** React is the first adapter, not the engine.

## Ecosystem

| Package | What it is |
|---|---|
| [`slz-form`](./packages/form) | The framework-agnostic engine. Zero runtime deps. |
| [`slz-react-form`](./packages/react-form) | The React adapter — provider + hooks. |

Angular and Vue adapters are planned against the same contract.

## License

[MIT](./LICENSE)
