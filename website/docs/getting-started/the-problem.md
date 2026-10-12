---
id: the-problem
title: The problem
sidebar_position: 1
description: What a dependent select really costs when you write it by hand.
---

# The problem

Every input in a real application calls for the same dozen mechanisms. Taken
one by one, none is hard. Put together, they produce this — a plain select
whose options depend on another field:

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

What costs you is not the length, it is what this code puts in place:

- **Business state lives in the component.** The parent becomes the owner of
  the value, of `touched`, of the options; it can no longer be moved or tested
  on its own.
- **Display rules are recomputed by hand.**
  `disabled={loading || submitting || !brand}` is rewritten, slightly
  differently, in every field. A rule that changes gets fixed in N places.
- **Dependencies between fields are implicit.** Nothing says this field depends
  on `brand`, except a `useEffect` array you have to read to find out.
- **Impossible states are representable.** Nothing prevents `touched=false`
  with a displayed `error`, or a spinner while the field is already in error.
- **Rendering spills over.** Lifting the value to the parent for the submit
  button re-renders every other field on each keystroke.
- **The logic is trapped in React.** The same business rule will have to be
  rewritten in Angular or in Vue.

## The same field, with the engine

The behavior is declared once, in the form's module:

```ts
const modelOptions = loadOptions({
    field: "model",
    watch: ["brand"],
    fetch: ({ brand }) => fetchModels(brand),   // brand: string, no cast
});
```

```tsx
<SelectField name="model" label="Model" required behaviors={[modelOptions]} />
```

No more `useState`, no more `useEffect`, no more hand-wired spinner, no more
`disabled` made of three booleans. It is not just shorter — what matters is
what it makes **impossible**.

## What the system guarantees

**Validity has a single authority.** Only the Validator produces it. No
behavior can contradict it, so there is never an arbitration between two
disagreeing sources. `IValidator<T>` is generic: the same contract covers text,
number, boolean, option list, file, date, time and datetime — each validator
judges its own type, without a single cast.

**Dependencies are declared, and checked.** A behavior or a validator lists the
fields it watches in `watch`. Reading an undeclared field **throws**, and a
cycle is rejected at wiring time rather than discovered as an infinite loop. A
field can read the others; it can never write one.

**A field that changes does not re-render the others.** Each field has its own
subscription and a referentially stable snapshot. Subscribing to the whole form
is an explicit choice, reserved for what needs it — a submit button, a summary.

**Nothing is typed by hand, and nothing wrong compiles.** The form declares
what each field holds; behaviors and hooks derive from it. See
[First form](first-form.md).

**The logic is written once, for every framework.** The core knows neither
React, nor Angular, nor Vue. The business rule will not be rewritten three
times.
