---
id: first-form
title: Premier formulaire
sidebar_position: 3
description: Créer un formulaire, lui ajouter un champ et une règle, lire son état — puis dériver des helpers typés depuis la map de champs.
---

# Premier formulaire

## Le moteur, seul

Aucun framework n'est nécessaire : ce code tourne tel quel dans un navigateur,
sous Node, Deno ou Bun.

```ts
import { FormController, IValidator, type ValidationReport } from "slz-form";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        if (!EMAIL.test(value)) report.error("Invalid email address");
    }
}

const form = new FormController<{ email: string }>({ name: "signup" });

const email = form.field("email", { required: true, validator: new EmailValidator() });

const unsubscribe = email.listen(() => console.log(email.snapshot.flags));
email.mount();
email.change("ada@lovelace.dev");

email.hasFlag("valid");   // true
```

Ce que fait chaque ligne :

- `new FormController<{ email: string }>({ name: "signup" })` crée le
  formulaire. L'argument de type est la **map de champs** : elle liste les
  champs et le type de chaque valeur. `name` identifie le formulaire ; il doit
  être unique dans votre application.
- `form.field("email", params)` crée le champ au premier appel et rend la
  **même instance** à chaque appel suivant. `params` n'est lu qu'à ce premier
  appel.
- `email.listen(callback)` s'abonne au champ : le callback s'exécute à chaque
  changement de son snapshot. Il rend la fonction qui désabonne.
- `email.mount()` fait entrer le champ dans le formulaire qu'on remplit. Un champ
  non monté est absent de `form.values()` et du verdict du formulaire.
- `email.change(value)` est ce qu'appelle une saisie quand l'utilisateur tape.
  Il marque le champ `touched` et lance le validator.
- `email.hasFlag("valid")` lit un flag. Il vaut `true` ici parce que le champ a
  été touché et que la règle a accepté la valeur.

Pour utiliser ce champ depuis du DOM sans framework, voir
[Sans framework](../guides/without-a-framework.md). Pour envoyer le formulaire,
voir [Soumettre un formulaire](../guides/submit.md).

## La map de champs, et ce qu'elle apporte

Dans une application, déclarez le formulaire une fois, dans son propre module —
comme on déclare une slice de store. Behaviors et hooks en dérivent, donc ils
sont typés par la map :

```ts
// src/form/car-configuration-form.ts
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

`CarFields` est un `type`, pas une `interface` : seul un alias de type porte la
signature d'index implicite qu'exige la contrainte `FieldsShape` du moteur. Avec
une `interface`, `new FormController<CarFields>` ne compile pas.

Les noms de champs sont désormais vérifiés — y compris contre le type de valeur
que manipule un composant. Dans la démo, `NumberField` n'accepte que les champs
numériques :

```tsx
<NumberField name="mileage" label="Mileage" />       // ✓
<NumberField name="brand" label="Brand" />           // ✗ brand is a string: does not compile
<TextField   name="typo" label="Unknown" />          // ✗ unknown field: does not compile
```

Le prix : ajouter un champ coûte une ligne dans la map en plus de celle dans la
vue. En échange, le code consommateur n'a besoin d'**aucun `as`**.

## Les behaviors prêts à l'emploi

`behaviorsFor(carForm)` rend sept helpers, tous typés par la map. Les champs
que vous listez dans `watch` sont exactement ce que reçoit le callback, avec
leurs types :

```ts
lookup({
    field: "model",
    watch: ["brand"],
    debounce: 400,
    fetch: ({ brand }) => fetchDefaultModel(brand),   // brand: string | undefined
});
```

| Helper | Ce qu'il fait |
|---|---|
| `prefill({ field, fetch })` | remplit le champ depuis une API à son montage — `loading` et `locked` pendant l'appel, toujours non touché ensuite |
| `lookup({ field, watch, debounce, fetch })` | appelle une API quand un champ observé change (ou quand le champ lui-même change, sans `watch`) et **écrit** le résultat |
| `loadOptions({ field, watch, on, debounce, fetch })` | charge la liste d'options du champ au montage, puis à nouveau quand un champ observé change |
| `suggest({ field, debounce, fetch })` | champ de recherche : recharge les suggestions à la frappe, sans verrouiller le champ |
| `lockWhile({ watch, when })` | verrouille le champ tant que `when` renvoie `true` |
| `hideWhen({ watch, when })` | masque le champ (`invisible`) tant que `when` renvoie `true` |
| `lockUntilValid({ watch })` | verrouille le champ jusqu'à ce que chaque champ observé soit accepté par son validator |

Les mêmes helpers existent aussi en fonctions nues, où le nom de champ et les
types sont à votre charge : `lookup`, `loadOptions`, `prefill`, `lockWhile`,
`hideWhen`, plus `dependsOn` et `createBehavior` pour écrire les vôtres.
Préférez les versions de `behaviorsFor`.

Quand aucun helper ne convient, vous écrivez le behavior à la main :
[Préremplir un champ](../guides/prefill.md) montre le même besoin écrit de trois
façons, de la classe complète jusqu'au helper.

## Le modèle en trente secondes

```
FormRegister              every form of the app (optional)
  └── FormController      one form: creates its fields, gathers values, gates submission
        ├── dependency graph   who watches whom; cycles rejected when a field is created
        └── FieldController    one input: value, interactions, flags, validity
              ├── behaviors      react → return the flags they want on the field
              ├── validator      judges the value → the only source of validity
              └── FieldSnapshot  what the component renders
```

## Des noms de champ qui ne sont pas des identifiants

Un champ peut s'appeler `Toto-1`, `2-champ` ou `champ avec espaces` : la map
accepte n'importe quelle clé, et le typage tient.

```ts
const form = new FormController<{ "Toto-1": string; "2-champ": number }>({ name: "f" });

form.field("Toto-1").snapshot.value   // string | undefined
```

Seule change la façon d'écrire un callback, parce que JavaScript ne peut pas
déstructurer un nom qui n'est pas un identifiant :

```ts
fetch: async ({ "Toto-1": toto1, "2-champ": deux }) => { … }   // string, number
fetch: async (deps) => deps["Toto-1"]                          // string | undefined
```

En revanche, ceci n'est pas du JavaScript valide :

```ts
fetch: async ({ Toto-1 }) => …
//                  ~ error TS1005: ',' expected
```

`Toto-1` se lit `Toto` moins `1` : c'est une erreur de syntaxe, pas une erreur
de type.
