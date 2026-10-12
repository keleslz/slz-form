---
id: first-form
title: Premier formulaire
sidebar_position: 3
description: Créer un champ, valider sa valeur et dériver des helpers depuis une déclaration typée.
---

# Premier formulaire

Cette page montre comment créer et valider un champ avec le cœur, puis dériver des behaviors typés et des hooks React pour un formulaire de voiture. Vous verrez aussi comment les noms de champs et les types de valeurs sont vérifiés.

## Le moteur, seul

`FormController` gère un formulaire et crée les contrôleurs de ses champs. Un contrôleur de champ stocke une valeur et exécute sa validation et ses behaviors. Un validator vérifie la valeur et signale les erreurs dans un `ValidationReport`, qui rassemble les messages d'une exécution de validation.

Cet exemple utilise le cœur sans framework d'interface. Il peut tourner dans un navigateur ou un environnement JavaScript comme Node, Deno ou Bun, une fois le package disponible dans cet environnement.

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

email.hasFlag("valid");   // true — change() a marqué le champ touché et validé la valeur
```

Le type passé à `FormController` est la map des champs : il associe chaque nom à un type de valeur. `field("email", ...)` crée le contrôleur au premier appel. Les appels suivants avec ce nom renvoient la même instance ; ils ne remplacent pas sa configuration initiale.

`listen` s'abonne aux changements d'état et renvoie une fonction de désabonnement. `mount` démarre le cycle de vie du champ et valide sa valeur initiale. `change` enregistre une interaction utilisateur et valide la nouvelle valeur. Un flag est un état nommé, comme `valid` ; `hasFlag` vérifie sa présence. Un snapshot est l'objet contenant la valeur, les messages et les flags actuels.

## La map, et ce qu'elle apporte

Conservez la déclaration du formulaire dans un module que vos composants peuvent importer. Un behavior réagit aux événements, par exemple en chargeant les options des modèles après un changement de marque. `behaviorsFor` crée des helpers dont les noms et les valeurs sont typés depuis la map. `hooksFor` crée les hooks React liés au même formulaire.

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

Utilisez un alias `type` pour `CarFields`. Pour cette forme d'objet, TypeScript fournit la signature d'index implicite nécessaire à `FieldsShape`, la contrainte `Record<string, unknown>` du moteur. Une interface équivalente ne satisfait pas cette contrainte.

Les hooks dérivés connaissent déjà le formulaire à utiliser. Ils vérifient le nom du champ et déduisent le type de sa valeur. Vos composants, comme `NumberField` et `TextField`, doivent limiter leurs props `name` aux types de champs correspondants pour que les exemples suivants soient vérifiés comme indiqué :

```tsx
<NumberField name="mileage" label="Kilométrage" />   // ✓
<NumberField name="brand" label="Marque" />          // ✗ brand est un string, ne compile pas
<TextField   name="typo" label="Inconnu" />          // ✗ champ inexistant, ne compile pas
```

Quand vous ajoutez un champ, ajoutez son nom et son type à la map ainsi que son composant à la vue. Les helpers déduisent ensuite les valeurs et les métadonnées des options sans demander de cast dans le parcours typé habituel. Les métadonnées sont des données supplémentaires associées à une option, comme un logo de marque ; déclarez-les avec `Field<Value, Meta>` si nécessaire.

## Les behaviors prêts à l'emploi

`behaviorsFor(carForm)` renvoie sept helpers. `watch` déclare les autres champs observés par un behavior. Leurs valeurs sont transmises au callback et peuvent être `undefined` avant que ces champs aient une valeur. `debounce: 400` diffère la requête jusqu'à l'expiration du délai d'attente configuré de 400 ms.

```ts
lookup({
    field: "model",
    watch: ["brand"],
    debounce: 400,
    fetch: ({ brand }) => fetchDefaultModel(brand),   // brand: string | undefined
});
```

Les helpers liés au formulaire et les exports directs ont des signatures différentes :

| Depuis `behaviorsFor(form)` — typés depuis la map | Exports directs — noms et types à configurer vous-même |
|---|---|
| `lookup`, `loadOptions`, `suggest`, `prefill`, `lockWhile`, `lockUntilValid`, `hideWhen` | `lookup`, `loadOptions`, `prefill`, `lockWhile`, `hideWhen`, `dependsOn`, `createBehavior` |

`lookup` charge une valeur pour son champ. `loadOptions` charge ses choix. `suggest` recharge les choix quand l'utilisateur saisit dans ce champ ; il n'a pas de paramètre `watch`. `prefill` charge une valeur initiale au montage. `lockWhile` verrouille le champ tant qu'une condition est remplie, et `hideWhen` le masque tant qu'une condition est remplie.

`lockUntilValid` verrouille tant qu'un champ observé est absent ou porte des erreurs bloquantes. C'est le seul helper de cette liste qui observe les changements de validité (`on: ["validity"]`). Les autres helpers peuvent observer des changements de valeur. Un champ encore `pristine`, c'est-à-dire sans interaction, peut satisfaire `lockUntilValid` s'il n'a aucune erreur.

Pour écrire un behavior personnalisé, voir [Préremplir un champ](../guides/prefill.md), qui développe le même exemple sous forme de classe puis de helper.

## Les objets utilisés

`FormRegister` conserve des formulaires nommés pour les retrouver ailleurs dans l'application. Un `DependencyGraph` enregistre quels champs observent quels autres champs et rejette les cycles. `IBehavior` définit le contrat des réactions aux événements, et `FieldSnapshot` contient l'état lu par votre composant.

```
FormRegister              formulaires enregistrés par l'application
  └── FormController      un formulaire, orchestre ses Fields
        ├── DependencyGraph   réactivité inter-champs, cycles rejetés au câblage
        └── FieldController   un input : valeur, interactions, flags, validité
              ├── IBehavior[]     réactions → retournent une contribution d'état
              ├── IValidator<T>   vérifications de valeur
              └── FieldSnapshot   ce que le composant rend
```

## Des noms de champ qui ne sont pas des identifiants

La map accepte des clés comme `Toto-1`, `2-champ` ou `champ avec espaces`. Le type de leur valeur est déduit de la même façon que pour les autres clés.

```ts
const form = new FormController<{ "Toto-1": string; "2-champ": number }>({ name: "f" });

form.field("Toto-1").snapshot.value   // string | undefined
```

Pour la déstructuration, mettez le nom de propriété entre guillemets et donnez-lui un nom de variable locale. Vous pouvez aussi utiliser un accès par crochets :

```ts
fetch: async ({ "Toto-1": toto1, "2-champ": deux }) => { … }   // string | undefined, number | undefined
fetch: async (deps) => deps["Toto-1"]                          // string | undefined
```

Dans cette déstructuration, laisser le nom sans guillemets produit une erreur de syntaxe :

```ts
fetch: async ({ Toto-1 }) => …
//                  ~ error TS1005: ',' expected
```

Le parseur lit le tiret comme un opérateur. Il échoue avant que TypeScript puisse vérifier le type du champ.
