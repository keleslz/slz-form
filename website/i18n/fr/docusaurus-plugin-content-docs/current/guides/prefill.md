---
id: prefill
title: Préremplir un champ
sidebar_position: 1
description: Remplir un champ depuis une API à son montage — écrit de trois façons, de la classe de behavior complète jusqu'au helper typé.
---

# Préremplir un champ

Pour remplir un champ depuis une API quand il apparaît, branchez-lui un
**behavior de préremplissage**. Voici le même besoin écrit de trois façons, de
la plus explicite à la plus courte. Les trois remplissent le champ de la même façon.

## 1. Une classe de behavior

Vous écrivez tout vous-même. Utile pour voir ce que fait le moteur, et point de
départ quand un behavior sort des sentiers battus.

```ts
import { Behavior, FormController, type BehaviorContext, type BehaviorState } from "slz-form";

class PrefillCustomerReference extends Behavior<string> {
    async onMount(ctx: BehaviorContext<string>): Promise<BehaviorState> {
        ctx.push(ctx.state.loading().lock());
        try {
            const reference = await fetchCustomerReference();
            if (!ctx.signal.aborted) {
                ctx.setValue(reference);
            }
        } catch {
            // a prefill that fails leaves the field empty:
            // it is not an input error, and the validator stays the only judge
        }
        return ctx.state.idle().unlock();
    }
}

const form = new FormController<{ customerReference: string }>({ name: "account" });

const field = form.field("customerReference", {
    behaviors: [new PrefillCustomerReference()],
});
field.mount();
```

Les flags du champ, dans l'ordre :

```
during the call   pristine, loading, locked, mounted
after the call    pristine, idle, mounted          ← value set, field still pristine
```

Trois choses à retenir :

- **Le champ reste `pristine`.** `ctx.setValue` ne marque pas le champ touché :
  une valeur venue d'une API n'est pas une action de l'utilisateur.
- **`ctx.push` affiche `loading` avant l'`await`.** La valeur de retour d'un
  hook n'est appliquée qu'à la résolution de la promesse ; sans `push`,
  `loading` ne serait jamais visible.
- **`ctx.signal` est avorté au démontage du champ.** Le vérifier après l'`await`
  empêche une réponse tardive d'écrire dans un champ qui n'existe plus.

## 2. Le même behavior, avec un validator

Ajoutez une règle. Rien ne change côté behavior : le behavior **écrit** la
valeur, le validator la **juge**, et ils ne se gênent pas. Le champ ci-dessous
est déclaré **à la place** de l'appel de la section 1 : les paramètres d'un
champ ne sont lus qu'à sa création, un second `form.field(...)` sur le même nom
les ignorerait.

```ts
import { IValidator, type ValidationReport } from "slz-form";

class ReferenceValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        report.errorIf(!/^CUST-\d{2}-\d{4}$/.test(value), "Expected format: CUST-42-9013");
    }
}

const field = form.field("customerReference", {
    required: true,
    validator: new ReferenceValidator(),
    behaviors: [new PrefillCustomerReference()],
});
```

```
after the prefill   pristine, idle, mounted, required            ← judged, but nothing displayed
the user types      error, idle, mounted, required, touched      ← "Expected format: CUST-42-9013"
they fix it         valid, idle, mounted, required, touched
```

**Une valeur préremplie n'affiche jamais d'erreur d'elle-même.** Le validator la
juge bien — `field.snapshot.errors` est rempli, et le verdict du formulaire en
tient compte —, mais le champ reste `pristine` jusqu'à ce que l'utilisateur le
touche, ou que `submit()` touche tous les champs.

## 3. Le helper typé

Le cas courant, en quelques lignes. `prefill` vient de `behaviorsFor(form)` : le
nom du champ et le type de la valeur sont vérifiés contre la map de champs. Là
encore, ceci remplace les déclarations précédentes du champ.

```ts
import { behaviorsFor } from "slz-form";

const { prefill } = behaviorsFor(form);

const customerReferencePrefill = prefill({
    field: "customerReference",
    fetch: () => fetchCustomerReference(),
});

const field = form.field("customerReference", {
    required: true,
    validator: new ReferenceValidator(),
    behaviors: [customerReferencePrefill],
});
```

Même résultat qu'avec la classe : `loading` + `locked` pendant l'appel, puis la
valeur, champ toujours `pristine`. Si `fetch` échoue ou résout `undefined`, le
champ reste vide.

Ce que le compilateur attrape :

```ts
prefill({ field: "reference", fetch: async () => "x" });
//        ~~~~~ Type '"reference"' is not assignable to type '"customerReference"'
```

Et sur un formulaire déclaré `{ customerReference: string; mileage: number }`,
un fetch du mauvais type ne compile pas non plus :

```ts
prefill({ field: "mileage", fetch: async () => "not a number" });
//                                             ~~~~~~~~~~~~~~
// Type 'Promise<"not a number">' is not assignable to type 'Promise<number | undefined>'
```

## Bon à savoir

- **`reset()` relance le prefill.** `field.reset()` et `form.reset()` rejouent
  `onMount` : l'API est rappelée, et sa réponse écrase la valeur restaurée.
- **Charger un enregistrement dans un formulaire déjà affiché** n'est pas un
  prefill : écrivez chaque valeur avec `field.update({ value })`. Cela ne marque
  pas le champ touché, mais déclenche les behaviors `onChange` du champ.
- **La valeur arrive après le montage du champ.** Un behavior qui lit la valeur
  dans son propre `onMount` la trouve vide.
