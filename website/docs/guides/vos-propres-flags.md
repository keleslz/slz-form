---
id: vos-propres-flags
title: Vos propres flags
sidebar_position: 5
description: Étendre le vocabulaire sans toucher au moteur — et pourquoi ses mots à lui sont refusés.
---

# Vos propres flags

Un behavior publie un mot, la vue le lit. Le moteur n'a jamais eu à le
connaître.

```ts
onMount: (ctx) => ctx.state.mark("skeleton"),
// plus tard
ctx.push(ctx.state.unmark("skeleton"));
```

```tsx
{field.hasFlag("skeleton") ? <Skeleton /> : <input … />}
```

C'est ce qui rend exprimables les besoins qu'on n'avait pas prévus — un
squelette de chargement, une vérification métier en cours, un badge — sans
ajouter quoi que ce soit au cœur.

## Pourquoi c'est sans risque

Les flags de l'application rejoignent la nature **cumulative** : ils
s'additionnent, et l'union ne peut pas se contredire. Deux behaviors qui posent
`skeleton` en même temps posent `skeleton` ; l'un qui le retire cesse simplement
de l'émettre.

## Les mots du moteur sont refusés

```ts
ctx.state.mark("error");     // lève
ctx.state.mark("loading");   // lève
```

Poser `error` à côté de `pristine` publierait un état qui n'existe pas, et poser
`loading` par ce chemin allumerait une activité que rien ne pourrait éteindre —
l'union des flags cumulés ne se soustrait pas.

La garde est dans `mark`, dans `unmark` **et** dans le constructeur de
`BehaviorState` : un behavior qui retourne une tranche construite à la main ne
la contourne pas.

La liste exacte est exportée — `RESERVED_FLAGS`, et `isReservedFlag(flag)` pour
la tester.
