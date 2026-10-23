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
unsubscribe();
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
  non monté est absent de `form.values()` et du
  [verdict](../index.md#vocabulary) du formulaire — s'il peut partir ou non.
- `email.change(value)` est ce qu'appelle une saisie quand l'utilisateur tape.
  Il marque le champ `touched` et lance le validator.
- `email.hasFlag("valid")` lit un flag. Il vaut `true` ici parce que le champ a
  été touché et que la règle a accepté la valeur.

Pour utiliser ce champ depuis du DOM sans framework, voir
[Sans framework](../guides/without-a-framework.md). Pour envoyer le formulaire,
voir [Soumettre un formulaire](../guides/submit.md).

## La map de champs, et ce qu'elle apporte

Dans une application, déclarez le formulaire une fois, dans un module à part que
le reste de l'application importe. Les behaviors prêts à l'emploi et les hooks
React en dérivent, donc ils sont typés par la map :

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
vue. En échange, noms de champs, valeurs et callbacks des helpers sont typés
**sans aucun `as`**. Trois endroits ne sont pas typés par la map, et vous les
affinez sans cast : `form.values()` est un `Record<string, unknown>` — lisez une
valeur typée avec `form.get(name)`
([Soumettre un formulaire](../guides/submit.md#what-you-send-formvalues)) ; un
formulaire pris dans le `FormRegister` n'est aujourd'hui pas typé — un écart
connu ; en attendant le correctif, importez le module propre au formulaire
([Les hooks](../react/hooks.md#formprovider-and-useformregister)) ;
et une valeur lue avec `ctx.watched()` est `unknown` — affinez-la
([Champs répétables](../guides/repeatable-fields.md#a-rule-about-the-whole-list)).

## Les behaviors prêts à l'emploi {#the-ready-made-behaviors}

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

Quelques options bonnes à connaître :

- `on` (`loadOptions`) : ce qui recharge la liste — `"mount"`, `"dependency"`
  (un champ observé a changé), `"change"` (l'utilisateur tape). Par défaut :
  `["mount"]`, plus `"dependency"` quand `watch` est renseigné.
- `resetOnReload` (`loadOptions`, `true` par défaut) : vider la valeur du champ
  quand un champ observé recharge la liste.
- `onError` (`loadOptions`) : appelé quand le chargement échoue. Sans lui, un
  échec ressemble à une liste vide.
- `pending` (`lookup`, `loadOptions`, `suggest`) : une fonction qui reçoit
  l'état du behavior et rend les flags à afficher pendant l'appel, par exemple
  `pending: (state) => state.loading()`. Par défaut : `loading` + `locked`
  (`suggest` : `loading` seul). La fonction exportée `openWhilePending` est
  cette version `loading` seul.

`prefill` et `lookup` laissent la valeur inchangée si `fetch` échoue, et
n'enregistrent rien : si vous avez besoin de le savoir, attrapez l'erreur dans
votre `fetch`. Les signatures exactes sont dans la
[référence API](/docs/reference/slz-form).

Certains existent aussi en fonctions nues, avec leurs propres signatures et
sans typage par la map : `lookup(fetcher, params)`,
`loadOptions(fetcher, params)`, `prefill(fetcher)`,
`lockWhile(condition, watch)`, `hideWhen(watch, predicate)`. `suggest` et
`lockUntilValid` n'existent que dans `behaviorsFor`. `dependsOn(watch, effect)`
et `createBehavior(definition)` vous aident à écrire les vôtres. Préférez les
versions de `behaviorsFor`.

Quand aucun helper ne convient, vous écrivez le behavior à la main :
[Préremplir un champ](../guides/prefill.md) montre le même besoin écrit de trois
façons, de la classe complète jusqu'au helper.

## Le modèle en trente secondes

- **`FormRegister`** — tous les formulaires de l'application, réunis en un seul
  endroit (facultatif).
  - **`FormController`** — un formulaire : crée ses champs, rassemble leurs
    valeurs, contrôle la soumission.
    - **graphe de dépendances** — qui observe qui ; un cycle est refusé à la
      création d'un champ.
    - **`FieldController`** — une saisie : sa valeur, ses interactions, ses
      flags et sa validité.
      - **behaviors** — réagissent, et rendent les flags qu'ils veulent sur le
        champ.
      - **validator** — juge la valeur ; la seule source de validité.
      - **`FieldSnapshot`** — ce que le composant affiche.

## Des noms de champ qui ne sont pas des identifiants

Un champ peut s'appeler `first-name`, `2nd-field` ou `name with spaces` : la map
accepte n'importe quelle clé — sauf `__proto__`, qui corrompt `form.values()` —
et le typage tient.

```ts
const form = new FormController<{ "first-name": string; "2nd-field": number }>({ name: "f" });

form.field("first-name").snapshot.value   // string | undefined
```

Seule change la façon d'écrire un callback, parce que JavaScript ne peut pas
déstructurer un nom qui n'est pas un identifiant. Dans un behavior qui observe
les deux champs :

```ts
fetch: async ({ "first-name": firstName, "2nd-field": second }) => { … }   // string | undefined, number | undefined
fetch: async (deps) => deps["first-name"]                                   // string | undefined
```

En revanche, ceci n'est pas du JavaScript valide :

```ts
fetch: async ({ first-name }) => …
//                   ~ error TS1005: ',' expected
```

`first-name` se lit `first` moins `name` : c'est une erreur de syntaxe, pas une
erreur de type.
