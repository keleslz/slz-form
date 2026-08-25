---
id: preremplir
title: Préremplir un champ
sidebar_position: 1
description: Le même besoin écrit de trois façons, de la classe entière à l'utilitaire en trois lignes.
---

# Préremplir un champ

Remplir un champ depuis une API au montage, écrit de trois manières — de la plus
explicite à la plus courte. Les trois produisent **exactement** le même
comportement.

## 1. Une classe de behavior, sans validator

Le cas où l'on écrit tout soi-même. Utile pour comprendre ce que fait le moteur,
et nécessaire dès qu'un comportement sort de l'ordinaire.

```ts
import { Behavior, type BehaviorContext, type BehaviorState } from "slz-form";

class PrefillCustomerReference extends Behavior<string> {
    async onMount(ctx: BehaviorContext<string>): Promise<BehaviorState> {
        ctx.push(ctx.state.loading().lock());
        try {
            const reference = await fetchCustomerReference();
            if (!ctx.signal.aborted) {
                ctx.setValue(reference);
            }
        } catch {
            // un prefill qui échoue laisse le champ vide :
            // ce n'est pas une erreur de saisie, et le Validator reste seul juge
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

Ce qui se passe, dans l'ordre :

```
pendant l'appel   pristine, loading, locked
après l'appel     pristine, idle          ← valeur posée, champ toujours pristine
```

Trois points méritent d'être retenus :

- **le champ reste `pristine`** : `ctx.setValue` ne marque pas le champ touché,
  parce qu'une valeur venue d'une API n'est pas une interaction utilisateur ;
- **`ctx.push` publie l'attente avant l'`await`** — sans lui, `loading` ne
  serait jamais visible, puisque rien n'est retourné tant que la promesse n'a
  pas résolu ;
- **`ctx.signal` est avorté au démontage** : c'est ce qui empêche une réponse
  tardive d'écrire dans un champ qui n'existe plus.

## 2. Le même behavior, avec un validator

On ajoute une règle. Rien ne change du côté du behavior : les deux ne se
marchent pas dessus, parce qu'ils n'agissent pas sur le même axe — le behavior
**écrit** une valeur, le validator la **juge**.

```ts
class ReferenceValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        report.errorIf(!/^CUST-\d{2}-\d{4}$/.test(value), "Format attendu : CUST-42-9013");
    }
}

const field = form.field("customerReference", {
    required: true,
    validator: new ReferenceValidator(),
    behaviors: [new PrefillCustomerReference()],
});
```

```
après le prefill        pristine, idle     ← le validator ne s'est pas prononcé
l'utilisateur saisit    error, idle        ← « Format attendu : CUST-42-9013 »
il corrige              valid, idle
```

**Une valeur préremplie ne déclenche pas d'erreur.** Le champ n'ayant pas été
touché reste `pristine` et n'affiche rien. Le validator ne tranche qu'à partir
de la première saisie — ou de la soumission, qui touche tous les champs.

## 3. L'utilitaire, entièrement typé

Le cas courant, en trois lignes. `prefill` vient de `behaviorsFor(form)`, donc
tout est inféré depuis la map du formulaire.

```ts
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

Comportement identique au premier exemple — `loading` + `locked` pendant
l'appel, valeur posée, champ toujours `pristine`.

Ce qui est vérifié à la compilation :

```ts
prefill({ field: "reference", fetch: async () => "x" });
//              ~~~~~~~~~~~ '"reference"' is not assignable to '"customerReference"'
```

Et sur un formulaire qui déclare `{ customerReference: string; mileage: number }`,
un fetch au mauvais type ne compile pas davantage :

```ts
prefill({ field: "mileage", fetch: async () => "pas un nombre" });
//                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~ 'string' is not
//                                 assignable to 'number'
```

Un nom de champ fautif et un fetch au mauvais type sont des **erreurs de
compilation**, pas des surprises à l'exécution.
