---
id: the-problem
title: The problem
sidebar_position: 1
description: What a dependent select really costs when you write it by hand, and what the engine guarantees instead.
---

# The problem

Every input in a real application needs the same handful of mechanisms: a
value, a "touched" state, an error, sometimes options loaded from an API, a
spinner, a disabled state. Taken one by one, none is hard. Put together, they
give this — a plain select whose options depend on another field:

```tsx
const [value, setValue] = useState("");
const [touched, setTouched] = useState(false);
const [error, setError] = useState<string>();
const [options, setOptions] = useState<Option[]>([]);
const [loadingOptions, setLoadingOptions] = useState(false);

useEffect(() => {
    setLoadingOptions(true);
    fetchModels(brand)
        .then((o) => { setOptions(o); setValue(""); })
        .finally(() => setLoadingOptions(false));
}, [brand]);

useEffect(() => {
    if (touched) setError(validate(value));
}, [value, touched]);

<select
    value={value}
    disabled={loadingOptions || isSubmitting || !brand}
    onChange={(e) => setValue(e.target.value)}
    onBlur={() => setTouched(true)}
>…</select>
{loadingOptions && <Spinner />}
{touched && error && <p className="error">{error}</p>}
```

The cost is not the length. It is what this code sets up:

- **The component owns business state.** The value, `touched` and the options
  live in the component. You cannot move or test that logic on its own.
- **Display rules are rewritten everywhere.**
  `disabled={loading || submitting || !brand}` appears, slightly different, in
  every field. A rule that changes gets fixed in N places.
- **Links between fields are hidden.** Nothing says this field depends on
  `brand`, except a `useEffect` dependency array you have to read.
- **Impossible states can be written.** Nothing prevents an error shown on an
  untouched field, or a spinner on a field already in error.
- **Re-renders spread.** Lifting the value to the parent for the submit button
  re-renders every other field on each keystroke.
- **The logic is stuck in React.** The same rule must be rewritten for Angular
  or Vue.

## The same field, with the engine

The reaction is declared once, in the module that declares the form.
`loadOptions` is one of the ready-made [behaviors](../index.md#vocabulary):

```ts
const modelOptions = loadOptions({
    field: "model",
    watch: ["brand"],
    fetch: ({ brand }) => fetchModels(brand),   // brand: string | undefined, no cast
});
```

The view only says which field it renders and what is attached to it
(`SelectField` is a component from the demo, not part of the library):

```tsx
<SelectField name="model" label="Model" required behaviors={[modelOptions]} />
```

No `useState`, no `useEffect`, no hand-wired spinner, no `disabled` built from
three booleans. While the options load, the field carries `loading` and
`locked`; when `brand` changes, the selection is cleared and the list reloads.

## What the engine guarantees

**One source of validity.** Only a validator decides whether a value is
accepted. No behavior can contradict it, so there is never a conflict to
resolve. `IValidator<T>` is generic: the same contract covers text, numbers,
booleans, option lists, files and dates, each validator judging its own type.

**Declared dependencies.** A behavior or a validator lists in `watch` the
fields it reads, and is re-run when they change. Reading a field through
`ctx.watched()` without declaring it **throws**, and a dependency cycle is
rejected when the field is created, not discovered as an infinite loop. A field
can read the others; it can never write to one. See
[Declared dependencies](../guides/dependencies.md).

**A field that changes does not re-render the others.** Each field has its own
subscription and a snapshot that keeps the same reference while nothing
changes. Subscribing to the whole form is an explicit choice, for what needs it
— a submit button, a summary.

**Typed from one declaration.** The form declares what each field holds;
behaviors and hooks are derived from it. A misspelled name or a value of the
wrong type does not compile. See [First form](first-form.md).

**Written once, for every framework.** The core knows neither React, nor
Angular, nor Vue. See [Without a framework](../guides/without-a-framework.md).
