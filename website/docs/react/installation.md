---
id: installation
title: Brancher React
sidebar_position: 1
description: Un module de formulaire, des hooks dérivés, aucun provider obligatoire.
---

# Brancher React

L'adapter est **un provider et trois hooks**. Aucune logique métier : elle vit
entièrement dans le core.

```bash
npm install slz-form slz-react-form
```

## Le module de formulaire

Déclarez le formulaire et sa map dans un module, puis dérivez-en ses hooks — le
même découpage qu'une slice :

```ts
// src/form/signup-form.ts
export type SignupFields = { email: string; postcode: string; city: string };

export const signupForm = new FormController<SignupFields>({ name: "signup" });

export const { useField, useFieldArray, useForm } = hooksFor(signupForm);
```

`name` est alors contraint aux champs déclarés, et la valeur est inférée. Il n'y
a **ni provider à monter, ni formulaire à nommer** sur chaque champ.

`FormProvider` et `useFormRegister` existent pour l'accès transverse au
`FormRegister` — utile quand un composant très éloigné doit atteindre un
formulaire —, pas pour le cas courant.

## Un champ

```tsx
function EmailField() {
    const field = useField({
        name: "email",              // ← contraint à SignupFields
        required: true,
        validator: new EmailValidator(),
    });

    if (field.hasFlag("invisible")) return null;

    return (
        <>
            <input
                value={field.value ?? ""}
                disabled={field.hasFlag("locked")}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
            />
            {field.hasFlag("loading") && <Spinner />}
            {field.hasFlag("error") && <p>{field.error}</p>}
            {field.warnings.map((warning) => <small key={warning}>{warning}</small>)}
        </>
    );
}
```

**Ajouter un champ au formulaire, c'est monter ce composant.** Rien à déclarer
en amont.

## Pas de rendu serveur, pour l'instant

`useField`, `useFieldArray` et `useForm` lisent leur état par
`useSyncExternalStore` **sans** `getServerSnapshot` : un `renderToString` lève
`Missing getServerSnapshot`. À monter côté client uniquement.
