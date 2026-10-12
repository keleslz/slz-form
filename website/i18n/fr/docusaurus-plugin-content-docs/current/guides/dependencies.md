---
id: dependencies
title: Dépendances déclarées
sidebar_position: 3
description: Réagir aux changements de valeur, de validité ou de chargement d'un autre champ.
---

# Dépendances déclarées

Cette page montre comment relancer la logique d'un champ quand un autre change. Vous pourrez choisir si cette réaction dépend de sa valeur, de sa validité ou de son activité.

Une dépendance est un champ nommé dans `watch` pour que ses changements déclenchent une réaction. Un behavior réagit aux événements de champ et peut modifier son propre champ. Un validator vérifie les valeurs et signale des erreurs ou des avertissements. Tous deux peuvent déclarer des dépendances ; le formulaire les enregistre dans un graphe et rejette les cycles lors de l'enregistrement des champs.

Vous pouvez par exemple verrouiller la ville tant que le code postal porte des erreurs bloquantes :

```ts
const { lockUntilValid } = behaviorsFor(form);

lockUntilValid({ watch: ["postcode"] });
```

`lockUntilValid` est un helper de `behaviorsFor(form)`. Il observe la validité et verrouille si un champ observé est indisponible ou porte des erreurs. Il n'exige pas que ce champ ait déjà reçu une interaction.

## Choisir les changements qui déclenchent un behavior

Pour un behavior, un nom de champ seul observe les changements de valeur :

```ts
{ watch: ["postcode"] }                                   // ≡ on: ["value"]
```

Avec ce choix par défaut, une revalidation du code postal ne recharge pas à elle seule les options de la ville. Pour d'autres réactions, nommez le type de changement dans `on` :

```ts
{ watch: [{ field: "postcode", on: ["value"] }] }      // défaut — la valeur change
{ watch: [{ field: "postcode", on: ["validity"] }] }   // le verdict — ce que fait lockUntilValid
{ watch: [{ field: "postcode", on: ["activity"] }] }   // loading / idle
```

`value` suit les changements de valeur. `validity` suit les changements de validation et de son état affiché. `activity` suit `loading` et `idle`. Ces noms sélectionnent les changements d'état qui déclenchent `onDependencyChanged(ctx, dependency)`.

Ce hook reçoit une vue en lecture seule du champ observé, avec notamment `dependency.value`, `dependency.errors` et `dependency.hasFlag(...)`. Un flag est un état nommé, comme `loading` ; `hasFlag` vérifie sa présence.

Les validators déclarent des noms de champs dans `watch` et se relancent quand ces valeurs changent. Ils n'utilisent pas les entrées `on` des behaviors.

## Modifier le champ dépendant

Le contexte fournit au behavior des méthodes de modification pour son propre champ et des vues en lecture seule des autres. Si un changement de marque demande de nouvelles options de modèles, placez le behavior de chargement sur le champ du modèle : il lit la marque et écrit ses propres options.

Déclarer à la fois « le modèle observe la marque » et « la marque observe le modèle » crée un cycle. Le graphe le rejette à l'enregistrement, avant qu'il entraîne des propagations répétées.

## Déclarer les lectures explicitement

Utilisez `ctx.watched` pour les champs listés dans `watch` :

```ts
ctx.watched("postcode")   // ✓ déclaré
ctx.watched("city")       // ✗ lève — reads "city" without declaring it in `watch`
```

Un nom non déclaré lève une exception dont le message identifie le champ et la déclaration manquante. Un champ déclaré peut toutefois être indisponible ; le résultat est alors `null`.

`ctx.form` offre aussi un accès général en lecture seule, dont `values()`. Le lire n'ajoute aucune dépendance ni aucun abonnement aux changements. Déclarez les champs dans `watch` chaque fois que leurs changements doivent relancer votre logique.
