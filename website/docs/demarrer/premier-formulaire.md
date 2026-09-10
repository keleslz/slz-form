---
id: premier-formulaire
title: Premier formulaire
sidebar_position: 3
description: Déclarer la map des champs, dériver les helpers typés, monter un champ.
---

# Premier formulaire

## Le moteur, seul

Aucun framework requis : ce code tourne tel quel dans un navigateur, sous Node,
Deno ou Bun.

```ts
import { FormController, IValidator, type ValidationReport } from "slz-form";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        if (!EMAIL.test(value)) report.error("Adresse email invalide");
    }
}

const form = new FormController<{ email: string }>({ name: "signup" });

const email = form.field("email", { required: true, validator: new EmailValidator() });

const unsubscribe = email.listen(() => console.log(email.snapshot.flags));
email.mount();
email.change("ada@lovelace.dev");

email.hasFlag("valid");   // true — change() a marqué le champ touché, la règle a jugé
```

La map passée à `FormController` déclare ce que vaut chaque champ ; tout le reste
s'en infère — le nom passé à `field()`, la valeur, le meta des options. Un
`field()` répété rend la même instance : le champ est créé au premier appel.

## La map, et ce qu'elle fait gagner

Le formulaire se déclare une fois, dans son module contextualisé — le pendant
d'une slice. Behaviors et hooks en sont dérivés, donc entièrement typés sur la
map :

```ts
// src/form/car-configuration-form.ts        (≈ une slice)
import { behaviorsFor, FormController } from "slz-form";
import { hooksFor } from "slz-react-form";

export type CarFields = {
    brand: string;
    model: string;
    mileage: number;
    licence: File;
};

export const carForm = new FormController<CarFields>({ name: "car-configuration" });

export const { lookup, loadOptions, suggest, prefill, lockWhile, lockUntilValid, hideWhen } =
    behaviorsFor(carForm);
export const { useField, useForm, useFieldArray } = hooksFor(carForm);
```

`CarFields` est un `type`, pas une `interface` : seul le premier porte la
signature d'index implicite qu'exige la contrainte `FieldsShape` du moteur.

Il n'y a plus de formulaire à nommer sur chaque champ, et `name` est vérifié —
y compris contre le **type** du champ :

```tsx
<NumberField name="mileage" label="Kilométrage" />   // ✓
<NumberField name="brand" label="Marque" />          // ✗ brand est un string, ne compile pas
<TextField   name="typo" label="Inconnu" />          // ✗ champ inexistant, ne compile pas
```

C'est le prix assumé du narrowing : ajouter un champ coûte une ligne dans la map
en plus de celle dans la vue. En échange, **aucun `as`** dans le code
consommateur.

## Les behaviors prêts à l'emploi

`behaviorsFor(carForm)` rend sept helpers, tous liés à la map. Ce qu'un champ
observe dans `watch` est ce que reçoit le callback, narrowé sur la map :

```ts
lookup({
    field: "model",
    watch: ["brand"],
    debounce: 400,
    fetch: ({ brand }) => fetchDefaultModel(brand),   // brand: string
});
```

Deux listes, et la distinction compte :

| Depuis `behaviorsFor(form)` — typés sur la map | Exports nus — le nom du champ est à votre charge |
|---|---|
| `lookup`, `loadOptions`, `suggest`, `prefill`, `lockWhile`, `lockUntilValid`, `hideWhen` | `lookup`, `loadOptions`, `prefill`, `lockWhile`, `hideWhen`, `dependsOn`, `createBehavior` |

`suggest` n'a pas de `watch` : il ne lit aucun autre champ. S'il n'existe que par
`behaviorsFor`, c'est parce que les options qu'il produit sont typées sur son
propre champ. `lockUntilValid`, lui, est le seul qui lit d'autres champs — il
observe leur **validité**, pas leur valeur (`on: ["validity"]`).

Quand le besoin sort de l'ordinaire, le même comportement s'écrit à la main :
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
fetch: async ({ "Toto-1": toto1, "2-champ": deux }) => { … }   // string, number
fetch: async (deps) => deps["Toto-1"]                          // string | undefined
```

En revanche, ceci n'est pas du JavaScript valide :

```ts
fetch: async ({ Toto-1 }) => …
//                  ~ error TS1005: ',' expected
```

`Toto-1` se lit comme `Toto` moins `1` : c'est une erreur de syntaxe, pas de
type — le compilateur échoue au parsing avant même de regarder les types.
