---
id: the-problem
title: The problem
sidebar_position: 1
description: Manage a dependent select without repeating its state logic in each component.
---

# The problem

This page uses a car model select to show which parts of form logic slz-form manages. You will see how to move option loading and field state out of a React component.

When the brand changes, you need to fetch the available models. The select also needs a value, validation messages and a disabled state during loading or submission. A component might implement these requirements like this:

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

This approach works, but leaves several things for you to coordinate:

- The component owns the value, interaction state and options. Testing that logic separately requires extracting it from React.
- Each input repeats conditions for loading, submission and dependencies. A change to a shared rule can require editing several components.
- The dependency on `brand` is recorded in the effect. You have to inspect effects to find all the relationships between fields.
- Independent state updates can leave stale options, messages or loading state unless you coordinate them, including responses arriving out of order.
- If a parent holds all values, updating one can render the parent and its children again.
- The effects depend on React. A different framework needs its own integration for that logic.

## The same field, with the engine

A behavior is an object that reacts to field events. Here, `loadOptions` creates a behavior that fetches the model options when the watched brand changes. `watch` lists the fields whose changes trigger the behavior. This example uses the helper returned by `behaviorsFor(form)`, which checks field names and callback types against your form declaration.

```ts
const modelOptions = loadOptions({
    field: "model",
    watch: ["brand"],
    fetch: ({ brand }) => fetchModels(brand),   // brand: string | undefined, no cast
});
```

Attach it to your select component:

```tsx
<SelectField name="model" label="Model" required behaviors={[modelOptions]} />
```

`SelectField` is an application component, like the ones in the demo. It still renders the select, spinner and messages, but reads their state from the engine. A flag is a named state such as `loading` or `locked`; the component checks flags instead of maintaining separate booleans for each rule.

## What the system checks

Validators check values and report errors or warnings. `IValidator<T>` lets you write a rule for the value type you use, including strings, numbers, booleans, option arrays, files and dates. Behaviors can update their own field's value, options and flags; their result does not contain a validity setting.

Behaviors and validators declare dependencies in `watch`. `ctx.watched(...)` throws if you request an undeclared name, and the dependency graph rejects cycles when fields are registered. The context gives read access to other fields and mutation methods for the behavior's own field. General form reads through `ctx.form` do not create a dependency automatically.

Each field has its own subscription and snapshot, an object describing its current state. The snapshot keeps the same reference until that state changes. An unrelated field update does not notify this subscription. Declared dependencies and React parent renders can still update other components. Use the whole-form subscription for components that need it, such as a submit button or summary.

Your field map declares the names and value types. The derived helpers check these types, so a misspelled name or an incompatible value is caught by TypeScript. Your own component props must preserve those constraints too. See [First form](first-form.md).

The core has no framework dependency. You can reuse behaviors and validators with another framework by connecting that framework's view to the controllers.
