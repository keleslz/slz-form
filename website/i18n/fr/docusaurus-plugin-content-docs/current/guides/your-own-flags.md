---
id: your-own-flags
title: Vos propres flags
sidebar_position: 5
description: Publier vos propres mots d'état depuis un behavior — un skeleton, un badge — et les lire dans la vue, sans toucher au moteur.
---

# Vos propres flags

Les flags du moteur couvrent ses propres besoins. Quand votre produit a besoin
d'un autre état — un skeleton de chargement, un badge « vérifié », un contrôle
métier en cours —, un behavior publie votre propre mot, et la vue le lit avec
`hasFlag`. Le moteur transporte le mot sans avoir à le connaître.

```ts
const skeletonUntilLoaded: IBehavior<string> = {
    onMount: async (ctx) => {
        ctx.push(ctx.state.mark("skeleton"));
        const name = await loadProfile(ctx.signal);
        if (!ctx.signal.aborted) {
            ctx.setValue(name);
        }
        return ctx.state.unmark("skeleton");
    },
};
```

```tsx
{field.hasFlag("skeleton") ? <Skeleton /> : <input … />}
```

- `ctx.state.mark(word)` ajoute le mot aux flags que pose ce behavior ;
  `ctx.state.unmark(word)` le retire.
- `ctx.push(...)` le publie immédiatement, avant l'`await`.
- Si la promesse du hook échoue, ce que cet appel avait ajouté — ici
  `skeleton` — est retiré, et l'erreur part dans
  [`form.engineErrors`](engine-errors.md).

## Pourquoi c'est sans risque

Vos mots sont des flags **cumulés** : ils s'additionnent, et un ensemble de mots
ne peut pas se contredire. Deux behaviors qui posent `skeleton` en même temps
posent `skeleton` ; celui qui le retire cesse simplement de le poser — le champ
le garde tant qu'un autre behavior le pose encore.

## Les mots du moteur sont refusés

```ts
ctx.state.mark("error");     // throws
ctx.state.mark("loading");   // throws
```

Poser `error` à côté de `pristine` publierait un état qui ne peut pas exister, et
poser `loading` par ce chemin allumerait un chargement que rien ne pourrait
éteindre. La vérification est dans `mark`, dans `unmark` **et** dans le
constructeur de `BehaviorState` : un behavior qui construit son état à la main
ne la contourne pas. Le refus lève une `EngineGuardError`, enregistrée dans
`form.engineErrors` avec `kind: "guard-violation"`.

Les mots du vocabulaire du moteur qu'un behavior **peut** poser sont `locked`,
`readonly` et `invisible`, par `lock()`, `readOnly()` et `hide()`. La liste
complète des mots réservés est exportée : `RESERVED_FLAGS`, et
`isReservedFlag(word)` pour en tester un.

## Sur un champ, pas sur le formulaire

Vos mots vivent sur le champ dont un behavior les pose. Le vocabulaire du
formulaire est fermé — `form.hasFlag("saving-draft")` ne compile pas — : pour un
état propre à tout le formulaire, posez le mot sur un champ et lisez ce champ.
