---
id: dependencies
title: Dépendances déclarées
sidebar_position: 3
description: Faire réagir un champ à un autre — sa valeur, son verdict ou son chargement — en le déclarant dans watch, sans jamais lui écrire.
---

# Dépendances déclarées

Quand un champ doit réagir à un autre — recharger ses options quand `brand`
change, se verrouiller tant que `postcode` n'est pas valide —, le behavior ou le
validator liste cet autre champ dans `watch`. Le moteur le rappelle alors chaque
fois que le champ observé change.

```ts
const { lockUntilValid } = behaviorsFor(form);

form.field("city", { behaviors: [lockUntilValid({ watch: ["postcode"] })] });
```

Le moteur construit le graphe de qui observe qui à la création de chaque champ.
Un **cycle** (`a` observe `b`, `b` observe `a`) ou un champ qui s'observe
lui-même est **refusé sur-le-champ** — `form.field()` lève une erreur — au lieu
d'être découvert plus tard en boucle infinie.

## C'est le champ qui reçoit qui travaille

Un champ peut lire les autres ; il ne peut **jamais** en écrire un. Pour vider
`region` quand `country` change, le behavior se pose sur `region` et observe
`country` :

```ts
const clearWhenCountryChanges: IBehavior<string> = {
    watch: ["country"],
    onDependencyChanged: (ctx) => ctx.clear(),
};

form.field("region", { behaviors: [clearWhenCountryChanges] });
```

Si plusieurs champs doivent réagir à un même champ, chacun déclare son propre
behavior. C'est ce qui garde le graphe prévisible : si un champ pouvait écrire
chez ses voisins, l'ordre d'exécution des behaviors deviendrait visible, et deux
behaviors pourraient s'écraser mutuellement sans qu'aucun ait tort.

## Ce qui réveille un behavior

Un nom seul réveille le behavior quand la **valeur** du champ observé change :

```ts
{ watch: ["postcode"] }                                   // same as on: ["value"]
```

C'est le défaut, et c'est voulu : toucher ou revalider `postcode` ne rejoue pas
les appels réseau des behaviors qui l'observent. Pour réagir à autre chose,
nommez-le :

```ts
{ watch: [{ field: "postcode", on: ["value"] }] }      // the value changed (default)
{ watch: [{ field: "postcode", on: ["validity"] }] }   // its verdict or displayed validity changed
{ watch: [{ field: "postcode", on: ["activity"] }] }   // it went loading / idle
```

`onDependencyChanged(ctx, dependency)` reçoit alors une vue **en lecture seule**
du champ observé — `dependency.name`, `dependency.value`,
`dependency.errors`, `dependency.hasFlag(...)` :

```ts
const lockWhileCountryInvalid: IBehavior<string> = {
    watch: [{ field: "country", on: ["value", "validity"] }],
    onDependencyChanged: (ctx, dependency) =>
        dependency.errors.length > 0 ? ctx.state.lock() : ctx.state.unlock(),
};
```

Le `watch` d'un validator est une simple liste de noms : la règle est relancée
quand la **valeur** de l'un de ces champs change.

Une liste déclarée avec `FieldArray` s'observe comme un champ : sa valeur est le
tableau des valeurs de ses lignes.

## Lire un champ observé

Dans un hook ou une règle, lisez un champ déclaré avec `ctx.watched(name)`. Il
rend la même vue en lecture seule, ou `null` si ce champ n'existe pas encore.

```ts
ctx.watched("postcode")   // ✓ declared
ctx.watched("city")       // ✗ throws: reads "city" without declaring it in `watch`
```

L'erreur est immédiate et nomme le champ. La façon dont elle est enregistrée
aujourd'hui dépend de l'endroit (voir [Les erreurs du moteur](engine-errors.md)) :

- dans un hook de behavior : dans `form.engineErrors`, comme `hook-error` ;
- dans un validator qui fait partie d'un tableau d'au moins deux : comme
  `guard-violation`, et le champ reçoit le constat bloquant `"unverified"`
  (ou le refus d'un autre membre) ;
- dans tout autre validator : c'est une règle qui lève. Si la règle n'est pas
  `async`, le champ garde aujourd'hui son verdict précédent — voir
  [l'écart connu](../model/interrupted-pass.md).

:::caution `ctx.form` n'est pas vérifié
`ctx.form.field(name)` et `ctx.form.values()` peuvent lire **n'importe quel**
champ, sans `watch` et sans erreur — et rien ne rappelle votre code quand ce que
vous avez lu change. Lire une dépendance de cette façon donne un résultat qui se
périme sans bruit. Utilisez `ctx.watched()` pour tout ce dont vous dépendez.
:::

## Un formulaire, un graphe

`watch` ne voit que les champs du même formulaire. Un champ d'un autre
formulaire, ou — dans une [ligne](../model/a-row-is-a-form.md) — un champ du
formulaire parent, ne peut pas être observé.
