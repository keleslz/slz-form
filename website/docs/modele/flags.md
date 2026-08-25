---
id: flags
title: Les flags, et les deux fonctions
sidebar_position: 1
description: Deux natures de flags, deux fonctions de lecture, et aucun booléen d'état.
---

# Les flags, et les deux fonctions

Ce qu'un champ **est** se lit en flags ; ce qu'il **contient** — valeur,
options, messages — se lit en données. Pour l'état, deux fonctions, et rien
d'autre :

```ts
field.hasFlag("loading", "invisible")   // ET  — toutes présentes
field.hasAny("locked", "readonly")      // OU  — au moins une
```

C'est ce qui supprime le `disabled={loading || submitting || !brand}` recomposé
à la main dans chaque champ. Le bouton de soumission tient en un appel :

```tsx
<button disabled={!form.hasFlag("valid", "idle")}>Envoyer</button>
```

## Le vocabulaire

| Flag | Nature | Qui l'émet |
|---|---|---|
| `pristine` · `valid` · `error` | **s'excluent** | le Validator, seul |
| `idle` · `loading` | **s'excluent** | Behaviors + Validator |
| `locked` · `readonly` · `invisible` | s'additionnent | Behaviors + Controller + vue |
| `required` · `touched` · `focused` · `mounted` · `submitting` | s'additionnent | le Controller |
| *ceux de votre application* | s'additionnent | Behaviors — `ctx.state.mark("skeleton")` |

Le formulaire répond aux mêmes deux fonctions, avec les mêmes mots : `valid` ·
`error` (le verdict), `idle` · `submitting` · `submitted`, `loading`, `touched`.

```ts
form.getSnapshot().hasFlag("valid", "idle");   // la soumission peut partir
```

## Deux natures, une règle par nature

Une union plate produirait des états impossibles — `pristine` **et** `error` à
la fois. Les deux premiers groupes sont donc **exclusifs**, à vocabulaire
fermé : y écrire une valeur en remplace une autre.

Tous les autres **s'additionnent**, et l'absence vaut défaut. Un seul `lock()`
verrouille, même si trois behaviors parlent en même temps. C'est ce qui donne un
sens précis au retrait d'un flag : on **remplace** dans un groupe exclusif, on
**cesse d'émettre** ailleurs.

## Le vocabulaire s'étend sans toucher au moteur

Un behavior publie `mark("skeleton")`, la vue lit `hasFlag("skeleton")`, et le
moteur n'a jamais eu à connaître le mot. Voir
[Vos propres flags](../guides/vos-propres-flags.md).

Les mots du moteur, eux, sont **refusés** sur ce chemin — sans quoi on
republierait l'état impossible qu'on vient d'écarter. `mark("error")` lève.

## Aucun booléen d'état dans la surface de lecture

Pas de `isVisible`, pas de `isLoading`, pas de `showError`. Un besoin de `isX`
ne signale jamais un accesseur manquant : il signale **un flag manquant, ou un
mot mal choisi**.

La raison est empirique. Une version antérieure a livré l'API par flags *et* ses
sept booléens dérivés dans le même diff : l'échappatoire est devenue la norme,
et l'API par flags est morte à l'usage.

## Affiché contre vrai

Une nuance structurelle, et la source d'à peu près toutes les confusions :

- au **champ**, `error` est ce qu'on **affiche**, et il reste éteint tant qu'on
  n'a pas touché — un préremplissage n'allume rien ;
- au **formulaire**, `error` est ce qui est **vrai** : un formulaire prérempli
  et faux ne part pas.

Le verdict d'un champ pris isolément, indépendamment de l'affichage, c'est
`errors` non vide.

```ts
field.hasFlag("error")       // faut-il montrer quelque chose à l'utilisateur ?
field.errors.length > 0      // cette valeur est-elle refusée ?
```
