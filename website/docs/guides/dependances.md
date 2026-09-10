---
id: dependances
title: Dépendances déclarées
sidebar_position: 3
description: Observer un voisin — sa valeur, ou son état — sans jamais écrire chez lui.
---

# Dépendances déclarées

Un behavior liste les champs qu'il observe. Le graphe est construit au câblage :
un **cycle est rejeté là**, pas découvert en boucle infinie à l'exécution.

```ts
const { lockUntilValid } = behaviorsFor(form);

lockUntilValid({ watch: ["postcode"] });
```

## Sur quel axe être réveillé

Un nom seul est déclenché par la **valeur** :

```ts
{ watch: ["postcode"] }                                   // ≡ on: ["value"]
```

C'est le défaut, et il évite qu'une revalidation rejoue les appels réseau des
behaviors qui observent le champ. Pour réagir à autre chose, on nomme l'axe :

```ts
{ watch: [{ field: "postcode", on: ["value"] }] }      // défaut — la valeur change
{ watch: [{ field: "postcode", on: ["validity"] }] }   // le verdict — ce que fait lockUntilValid
{ watch: [{ field: "postcode", on: ["activity"] }] }   // loading / idle
```

`onDependencyChanged(ctx, dependency)` reçoit alors la vue du champ observé —
`dependency.value`, `dependency.errors`, `dependency.hasFlag(...)` — en lecture
seule.

## Lire, jamais écrire

Un champ peut lire les autres ; il ne peut **jamais** en écrire un. Les
verrouillages, masquages et rechargements croisés passent tous par cette
lecture, sans mutation.

C'est ce qui rend le graphe fiable : si écrire chez le voisin était possible,
l'ordre d'exécution deviendrait observable, et deux behaviors pourraient se
contredire sans qu'aucun ait tort.

## Lire un champ non déclaré lève

```ts
ctx.watched("postcode")   // ✓ déclaré
ctx.watched("city")       // ✗ lève — reads "city" without declaring it in `watch`
```

L'erreur est immédiate et nommée. Une dépendance implicite est précisément ce
qu'on ne veut pas pouvoir installer par distraction.
