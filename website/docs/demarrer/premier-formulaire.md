---
id: premier-formulaire
title: Premier formulaire
sidebar_position: 3
description: Déclarer la map des champs, dériver les helpers, monter un champ.
---

# Premier formulaire

## Le moteur, seul

```ts
import { behaviorsFor, FormController, IValidator, type ValidationReport } from "slz-form";

class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport) {
        report.errorIf(!value.includes("@"), "Adresse email invalide");
    }
}

// la map déclare ce que vaut chaque champ : tout le reste s'infère
const form = new FormController<{ email: string; postcode: string; city: string }>({
    name: "signup",
});

const email = form.field("email", { required: true, validator: new EmailValidator() });
email.listen(() => render(email.snapshot));
email.mount();
email.change("ada@lovelace.dev");

email.hasFlag("valid");   // true
```

Aucun framework requis : ce code tourne tel quel dans un navigateur, sous Node,
Deno ou Bun.

## La map, et ce qu'elle fait gagner

Le formulaire déclare ce que vaut chaque champ ; behaviors et hooks en dérivent.
Écrit une fois, dans le module du formulaire :

```ts
// src/form/car-configuration-form.ts        (≈ une slice)
export type CarFields = {
    brand: string;
    model: string;
    mileage: number;
    licence: File;
};

export const carForm = new FormController<CarFields>({ name: "car-configuration" });

export const { lookup, loadOptions, suggest, prefill } = behaviorsFor(carForm);
export const { useField, useFieldArray, useForm } = hooksFor(carForm);
```

Il n'y a plus de formulaire à nommer sur chaque champ, et `name` est vérifié —
y compris contre le **type** du champ :

```tsx
<NumberField name="mileage" />   // ✓
<NumberField name="brand" />     // ✗ ne compile pas : brand est un string
<TextField   name="typo" />      // ✗ ne compile pas : champ inexistant
```

C'est le prix assumé du narrowing : ajouter un champ coûte une ligne dans la map
en plus de celle dans la vue. En échange, **aucun `as`** dans le code
consommateur.

## Les behaviors prêts à l'emploi

Dérivés du formulaire, donc entièrement typés :

```ts
const { lookup, suggest, prefill } = behaviorsFor(carForm);

lookup({
    field: "city",
    watch: ["postcode"],
    debounce: 400,
    fetch: ({ postcode }) => fetchCity(postcode),   // postcode: string
});
```

Deux listes, et la distinction compte :

| Depuis `behaviorsFor(form)` — typés sur la map | Exports nus — le nom du champ est à votre charge |
|---|---|
| `lookup`, `loadOptions`, `suggest`, `prefill`, `lockWhile`, `lockUntilValid`, `hideWhen` | `lookup`, `loadOptions`, `prefill`, `lockWhile`, `hideWhen`, `dependsOn`, `createBehavior`, `lockedWhilePending`, `openWhilePending` |

`suggest` et `lockUntilValid` n'existent que par `behaviorsFor` : ils lisent
d'autres champs, donc ils n'ont de sens qu'une fois liés à une map qui les
déclare.

Le même besoin s'écrit toujours à la main quand il sort de l'ordinaire :
[les trois formes du même prefill](../guides/preremplir.md) montrent le passage
de la classe écrite entièrement à l'utilitaire en trois lignes.

## Le modèle en trente secondes

```
FormRegister              tous les formulaires de l'app          (≈ root reducer)
  └── FormController      un formulaire, orchestre ses Fields    (≈ slice)
        ├── DependencyGraph   réactivité inter-champs, cycles rejetés au câblage
        └── FieldController   un input : valeur, interactions, flags, validité
              ├── IBehavior[]     réactions → retournent une tranche d'état
              ├── IValidator<T>   autorité de validité
              └── FieldSnapshot   ce que le composant rend
```

## Des noms de champ qui ne sont pas des identifiants

Un champ peut s'appeler `Toto-1`, `2-champ` ou `champ avec espaces` : la map
accepte n'importe quelle clé, et le narrowing tient intégralement.

```ts
const form = new FormController<{ "Toto-1": string; "2-champ": number }>({ name: "f" });

form.field("Toto-1").snapshot.value   // string | undefined
```

Seule l'**écriture** du callback change, parce que JavaScript ne sait pas
destructurer un nom qui n'est pas un identifiant :

```ts
// destructuration avec renommage
fetch: async ({ "Toto-1": toto1, "2-champ": deux }) => { … }   // string, number

// ou accès par index
fetch: async (deps) => deps["Toto-1"]                          // string | undefined
```

En revanche, ceci n'est pas du JavaScript valide :

```ts
fetch: async ({ Toto-1 }) => …
//                  ~ error TS1005: ',' expected
```

`Toto-1` se lit comme `Toto` moins `1` : c'est une erreur de syntaxe, pas de
type — le compilateur échoue au parsing avant même de regarder les types.
