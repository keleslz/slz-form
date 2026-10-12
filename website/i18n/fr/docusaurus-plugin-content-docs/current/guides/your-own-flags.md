---
id: your-own-flags
title: Vos propres flags
sidebar_position: 5
description: Publier un état applicatif depuis un behavior et le lire dans vos composants.
---

# Vos propres flags

Cette page montre comment ajouter un flag applicatif, comme `skeleton`, sans modifier le moteur. Vous verrez comment le retirer et quels noms sont réservés.

Un flag est un état nommé que votre composant vérifie avec `hasFlag` ou `hasAny`. Un behavior réagit aux événements de champ et renvoie ou publie un `BehaviorState`, sa contribution à l'activité et aux flags du champ. Utilisez `mark` pour ajouter un flag personnalisé à cette contribution.

Un champ peut par exemple afficher un squelette pendant le chargement de ses données initiales :

```ts
onMount: (ctx) => ctx.state.mark("skeleton"),
```

Quand les données arrivent, le même behavior retire sa contribution avec `unmark` et publie l'état mis à jour :

```ts
ctx.push(ctx.state.unmark("skeleton"));
```

Votre vue peut alors choisir entre le squelette et l'input :

```tsx
{field.hasFlag("skeleton") ? <Skeleton /> : <input … />}
```

Le moteur conserve ce flag personnalisé comme les autres flags cumulatifs. Votre application définit sa signification et son affichage. Vous pouvez utiliser le même mécanisme pour une vérification métier ou un badge.

## Combiner les contributions

Les flags personnalisés des différents behaviors sont rassemblés. Si deux behaviors publient `skeleton`, il reste présent jusqu'à ce que les deux cessent de le publier. `unmark("skeleton")` le retire uniquement de l'état propre au behavior.

`BehaviorState` est immuable : `mark` et `unmark` renvoient un nouvel objet. Renvoyez cet objet depuis le hook ou transmettez-le à `ctx.push` ; appeler une méthode sans publier son résultat ne modifie pas l'état du contrôleur.

## Les noms réservés

Certains flags du moteur utilisent des API dédiées ou sont gérés par le contrôleur. Ils ne peuvent pas être ajoutés comme marqueurs personnalisés :

```ts
ctx.state.mark("error");     // lève
ctx.state.mark("loading");   // lève
```

Les flags de validité comme `error` viennent de la validation, et l'activité est définie avec `loading()` ou `idle()`. Cela conserve un seul état de validité affichée et un seul état d'activité sur un champ. Les flags d'interaction comme `touched` sont aussi réservés.

La vérification s'applique dans `mark`, `unmark` et le constructeur de `BehaviorState`. Elle lève une `EngineGuardError` pour un marqueur réservé, y compris dans un objet d'état construit à la main.

`RESERVED_FLAGS` exporte la liste exacte ; `isReservedFlag(flag)` vérifie un nom. Les flags de disponibilité `locked`, `readonly` et `invisible` sont autorisés via `mark` et disposent aussi de méthodes dédiées comme `lock()` et `hide()`.
