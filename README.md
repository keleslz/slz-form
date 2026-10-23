<div align="center">

# slz-form

**slz-form is a TypeScript-first, framework-agnostic form engine.**
Declare your fields, behaviors, and validation rules, and let the engine own
the state, the UI states, and the interactions between fields.

[Documentation](https://keleslz.github.io/slz-form/) ·
[The model](https://keleslz.github.io/slz-form/conception/MODEL) ·
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
const { hasFlag } = useForm();

<button disabled={!hasFlag("valid", "idle")}>Submit</button>
```

(One trap with this exact guard after a successful submit — see
[Submission](#submission).)

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
and `slz-form` as peers: your app must resolve a single copy of each.

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

type SignupFields = { email: string; password: string };

const form = new FormController<SignupFields>({ name: "signup" });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        if (!EMAIL.test(value)) report.error("Invalid email address");
    }
}

const email = form.field("email", { required: true, validator: new EmailValidator() });
const password = form.field("password", { required: true });

email.mount();
password.mount();

email.change("ada@example.com");
password.change("hunter2");

if (await form.submit()) {
    await fetch("/api/signup", { method: "POST", body: JSON.stringify(form.values()) });
}
```

- `form.field(name, params)` creates the field on the first call and returns
  the same controller afterwards (`params` are only read the first time).
- `field.mount()` puts it into the form being filled: only mounted fields count
  in `form.values()` and in the verdict.
- `field.change(v)`, `field.focus()`, `field.blur()` drive it, the way an input
  would; `field.snapshot` reads it (`.value`, `.errors`, `.hasFlag(...)`).
- `form.submit()` touches every mounted field, waits for async work, and answers
  whether the form may be sent — it sends nothing itself.

Everything below is the same engine, seen from different angles.

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
| `readonly` | cumulative | Behaviors + view | readable, selectable, not modifiable |
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
import { behaviorsFor, FormController } from "slz-form";

type CarFields = { brand: string; otherBrand: string; consent: boolean };

const carForm = new FormController<CarFields>({ name: "car" });

const { prefill, lockWhile, hideWhen } = behaviorsFor(carForm);

const brandPrefill = prefill({ field: "brand", fetch: () => fetchDefaultBrand() });

const lockedUntilConsent = lockWhile({
    watch: ["consent"],
    when: ({ consent }) => consent !== true,
});

const onlyWhenOther = hideWhen({
    watch: ["brand"],
    when: ({ brand }) => brand !== "other",
});

carForm.field("brand", { behaviors: [brandPrefill] });
carForm.field("otherBrand", { behaviors: [onlyWhenOther, lockedUntilConsent] });
```

The other helpers — `lookup`, `loadOptions`, `suggest`, `lockUntilValid` — are
listed in [First form](https://keleslz.github.io/slz-form/docs/getting-started/first-form#the-ready-made-behaviors).

`prefill` fills a field from an API on mount, locked and `loading` meanwhile;
`lockWhile` and `hideWhen` react to other fields declared in `watch`.

> A field hidden by `hideWhen` is left out of the verdict, but **not** out of
> the payload: while it is mounted, `form.values()` still contains it. To leave
> a field out of what you send, unmount it.

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
import { DebouncedValidator } from "slz-form";

new DebouncedValidator(new UsernameValidator(), 400);
```

`DebouncedValidator` delays an expensive rule while the user types;
`ExternalValidator` carries issues your code received from a server (a 422, for
instance) and applies them without the value changing.
Rules do not run on an empty value (that is what `required` is for), unless the
validator opts in.

## Cross-field dependencies

A validator or behavior that reads other fields declares them in `watch` — and
only then is it re-run when they change. Reading an undeclared field with
`ctx.watched()` throws. The engine catches that error and records it in
`form.engineErrors` (it can also leave the field with a stale verdict — see
[Declared dependencies](https://keleslz.github.io/slz-form/docs/guides/dependencies#reading-a-watched-field)),
so read that buffer while you develop:

```ts
import { IValidator, type ValidationReport, type ValidationContext } from "slz-form";

class ConfirmPasswordValidator extends IValidator<string> {
    watch = ["password"];
    protected validate(value: string, report: ValidationReport, ctx: ValidationContext): void {
        if (value !== ctx.watched("password")?.value) report.error("Passwords do not match");
    }
}
```

Dependencies are wired into a graph that rejects cycles when a field is
created, so a change propagates through the whole chain — `a → b → c` — and
never loops. Current limitation: a synchronous chain longer than 50 links is
cut, and throws out of the `change()` call that started it.

> `ctx.form.field(name)` and `ctx.form.values()` can also read other fields,
> but they are **not** checked against `watch` and nothing re-runs your code
> when they change. Use `ctx.watched()` for anything you depend on.

## Repeatable fields

A repeatable list has **no path-based naming**. Each row *is* a full
`FormController`, identified and never indexed — so removing or moving a row
renames nothing, and no `watch` ever starts pointing into the void.

```ts
import { FormController, type FieldArray } from "slz-form";

type OrderFields = { lines: FieldArray<{ product: string; qty: number }> };

const form = new FormController<OrderFields>({ name: "order" });
const lines = form.array("lines");

const first = lines.append();       // a stable row id, never an index
const second = lines.append();
const qty = lines.row(first)?.field("qty");
qty?.mount();
qty?.change(2);
lines.move(0, 1);                   // the order changes, the ids do not
lines.remove(second);

lines.values();                     // [{ qty: 2 }]
```

## Submission

`form.submit()` is a **gate, not a sender**. It returns `Promise<boolean>` and,
in order: touches every mounted field (so pristine required-empty fields now
show their error), fires `onSubmit` behaviors and runs anything waiting on a
debounce now, waits for async work to finish (bounded by `settleTimeout`,
with one known gap: a rule whose promise never settles during the final
re-validation blocks
`submit()` for good — see
[Settings](https://keleslz.github.io/slz-form/docs/guides/submit#settings)),
revalidates, and returns `true` only if that work finished in time and the
form is valid.

```ts
if (await form.submit()) {
    await api.save(form.values());
    form.reset();
}
```

A `false` return means the form is invalid (its errors are now on screen), it
did not finish its async work in time, or a submission was already running. Keep the two
reads distinct: `form.snapshot.hasFlag("valid", "idle")` is the passive "is it
ready right now?" for a disabled button; `await form.submit()` is the active
"make it ready, then judge." The actual network call is your code, after the
gate opens — the engine never sends anything.

> After a successful `submit()`, the form stays `submitted` until `reset()` or
> the next `submit()`: editing a field does not bring it back to `idle`. A button guarded by
> `!hasFlag("valid", "idle")` therefore stays disabled after the first send
> unless you reset. If the form stays on screen after sending, guard on
> `hasFlag("submitting")` instead. Details:
> [Submit a form](https://keleslz.github.io/slz-form/docs/guides/submit).

## Engine errors

When the **code** of a behavior or a rule *throws* — an async hook rejects, an
engine guard is violated, a rule crashes — the engine catches it, recovers, and
records it. It **never logs to the console**: that is the consumer's call, not
the engine's.

You read those records off the form, when you have a reason to — after a
rejected submit, in a debug panel, in a test:

```ts
if (!(await form.submit())) {
    for (const err of form.engineErrors) {
        reportToSentry(err);
    }
}
```

Each `EngineError` carries `scope`, `kind` (`"hook-error"` or
`"guard-violation"`), `field`, `rule` (validator errors only), `error`, and
`at`.

This is a **pull** surface — an accessor, not a subscription. An engine error is
a crash the engine already recovered from: a diagnostic record, not a live event
to handle in real time. The buffer is bounded to the most recent entries and
cleared by `reset()`.

> This is **not** how you read validation errors. A field that fails its rules
> is not an engine error — read it with `field.snapshot.errors`,
> `field.snapshot.issues`, or `field.hasFlag("error")`. `engineErrors` is only
> for when the code itself throws.

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
        <button disabled={hasFlag("submitting")} onClick={() => void submit()}>
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
In plain JavaScript you make the same three gestures by hand: **read**
`field.snapshot`, **subscribe** with `field.listen(callback)` — it returns the
function that unsubscribes —, and **write** with `field.change(value)`. Mount
the field so it takes part in the form:

```ts
const render = () => {
    const s = field.snapshot;
    input.disabled = s.hasFlag("locked");
    errorEl.textContent = s.hasFlag("error") ? s.errors[0] ?? "" : "";
};
const stopListening = field.listen(render);
input.addEventListener("input", () => field.change(input.value));
field.mount();
render();
```

When the input goes away, call `stopListening()` and `field.unmount()`.

A complete example, with the field lifecycle, is in
[Without a framework](https://keleslz.github.io/slz-form/docs/guides/without-a-framework).
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
