---
id: prefill
title: Préremplir un champ
sidebar_position: 1
description: Charger une valeur initiale au montage tout en conservant le champ sans interaction.
---

# Préremplir un champ

Cette page montre comment charger une référence client au montage d'un champ, verrouiller l'input pendant la requête et valider le résultat. Vous pouvez écrire le behavior vous-même ou utiliser le helper typé `prefill`.

Un prefill est une valeur définie par votre application avant la saisie utilisateur. Un behavior réagit aux événements d'un champ et peut modifier sa valeur. Un validator vérifie la valeur et signale des erreurs ou des avertissements. Les flags sont des états nommés, comme `loading`, que votre vue lit pour choisir son affichage.

## 1. Une classe de behavior, sans validator

La version sous forme de classe montre explicitement le hook du cycle de vie et l'état intermédiaire. `BehaviorContext` donne accès au champ ; `BehaviorState` décrit la contribution de ce behavior à son activité et à sa disponibilité. `onMount` s'exécute au montage du champ.

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
            // la validation signale les problèmes de valeur du champ
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

Pour un champ initialement vide et sans interaction, les flags évoluent ainsi :

```
pendant l'appel   pristine, loading, locked
après l'appel     pristine, idle          ← valeur posée, champ toujours pristine
```

- `ctx.setValue` écrit la valeur et déclenche la validation sans marquer le champ `touched`. La validité affichée reste donc `pristine` jusqu'à une interaction.
- `ctx.push` publie `loading` et `locked` avant l'`await`, pour que la vue affiche un indicateur et désactive l'input pendant la requête. Renvoyer une promesse depuis un behavior ne publie pas ces flags à lui seul.
- `ctx.signal` est annulé au démontage. La vérification après l'`await` évite une écriture tardive ; transmettez aussi ce signal à votre appel réseau si vous souhaitez annuler la requête.

Ce catch ignore volontairement un échec de préremplissage. Le champ initialement vide reste vide, et le behavior libère ses flags de chargement et de verrouillage. Pour un champ qui avait déjà une valeur, cet échec la laisserait en place.

## 2. Le même behavior, avec un validator

Ajoutez un validator pour vérifier le format de la référence chargée. `ValidationReport` rassemble les erreurs et les avertissements d'une exécution de validation.

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

L'affichage peut suivre cette séquence quand l'utilisateur saisit une référence invalide, puis la corrige :

```
après le prefill        pristine, idle     ← valeur validée, erreur encore masquée
l'utilisateur saisit    error, idle        ← « Format attendu : CUST-42-9013 »
il corrige              valid, idle
```

La validation s'exécute au montage et quand `ctx.setValue` change la valeur. Une valeur préremplie invalide peut donc figurer dans `field.errors` et bloquer immédiatement la soumission du formulaire. Le champ sans interaction reste `pristine`, donc un message conditionné par `hasFlag("error")` reste masqué.

`change` et `blur` marquent le champ comme touché. La soumission touche aussi les champs montés et les valide. Ces interactions permettent au champ d'afficher son résultat de validation. Lire directement `field.errors` donne les messages bloquants indépendamment de l'état d'affichage.

## 3. Le helper typé

`behaviorsFor(form)` renvoie des helpers qui vérifient les noms et les valeurs à partir de la map, le type qui associe chaque nom de champ à sa valeur. Utilisez son helper `prefill` pour ce chargement au montage :

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

Le helper publie `loading` et `locked` pendant le chargement, écrit la valeur renvoyée et laisse un champ sans interaction `pristine`. Il intercepte un échec du chargement et conserve la valeur existante. Un retour `undefined` conserve également la valeur.

TypeScript vérifie le nom du champ :

```ts
prefill({ field: "reference", fetch: async () => "x" });
//              ~~~~~~~~~~~ '"reference"' is not assignable to '"customerReference"'
```

Il vérifie aussi la valeur renvoyée. Sur un formulaire déclarant `{ customerReference: string; mileage: number }`, ce fetch renvoie un type incompatible :

```ts
prefill({ field: "mileage", fetch: async () => "pas un nombre" });
//                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~ 'string' is not
//                                 assignable to 'number'
```

Ces erreurs sont détectées à la compilation lorsque vous utilisez le helper typé.
