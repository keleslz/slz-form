---
id: flags
title: Les flags, et les deux fonctions
sidebar_position: 1
description: Tout état d'un champ ou d'un formulaire est un flag, lu par hasFlag (ET) et hasAny (OU). Le vocabulaire complet, et qui pose chaque mot.
---

# Les flags, et les deux fonctions

Un **flag** est un mot qui décrit un état : `loading`, `locked`, `error`,
`touched`… Ce qu'un champ **est** se lit en flags. Ce qu'il **contient** — sa
valeur, ses options, ses messages — se lit en données.

Pour lire les flags, il y a deux fonctions, et rien d'autre :

```ts
field.hasFlag("loading", "invisible")   // AND — every flag is present
field.hasAny("locked", "readonly")      // OR  — at least one is present
```

C'est ce qui remplace le `disabled={loading || submitting || !brand}` écrit à la
main dans chaque champ :

```tsx
<input disabled={field.hasFlag("locked")} readOnly={field.hasFlag("readonly")} />
```

Les deux mêmes fonctions existent sur un champ (`FieldController`, son snapshot,
et `useField()`) et sur un formulaire (son snapshot, et `useForm()`).

## Les flags d'un champ

| Flag | Groupe | Posé par | Sens |
|---|---|---|---|
| `pristine` · `valid` · `error` | **un seul à la fois** | le validator, seul | la validité **affichée** : `pristine` tant que le champ n'a pas été touché |
| `idle` · `loading` | **un seul à la fois** | les behaviors et le validator | `loading` tant qu'un travail asynchrone tourne sur le champ |
| `locked` | cumulé | les behaviors, le moteur, la vue | grisé, non modifiable |
| `readonly` | cumulé | les behaviors, la vue | lisible et sélectionnable, non modifiable |
| `invisible` | cumulé | les behaviors | à ne pas afficher — voir la note ci-dessous |
| `required` | cumulé | le moteur (depuis `required: true`) | le champ est obligatoire |
| `touched` | cumulé | le moteur | l'utilisateur a modifié ou quitté le champ, ou `submit()` l'a touché |
| `focused` | cumulé | le moteur | le champ a le focus |
| `mounted` | cumulé | le moteur | le champ fait partie du formulaire qu'on remplit |
| `submitting` | cumulé | le moteur | le formulaire est en cours de soumission ; s'accompagne de `locked` |
| *vos propres mots* | cumulé | les behaviors — `ctx.state.mark("skeleton")` | voir [Vos propres flags](../guides/your-own-flags.md) |

« La vue », c'est votre composant : `useField({ locked, readOnly })`, ou
`field.update({ locked, readOnly })` en code sans framework.

:::note Un champ invisible est quand même envoyé
`invisible` retire le champ du **verdict** : un champ obligatoire masqué ne
bloque pas le formulaire. Il ne le retire **pas** du **payload** : tant que le
champ est monté, `form.values()` contient sa valeur. Pour qu'un champ ne parte
pas, démontez-le (en React, cessez d'afficher son composant).
:::

## Les flags d'un formulaire

Un formulaire emploie les mêmes mots, à une différence près, expliquée plus bas.

| Flag | Groupe | Sens |
|---|---|---|
| `valid` · `error` | un seul à la fois | le **verdict** : aucun champ monté et visible, ni aucune ligne d'une liste, n'a de constat bloquant — ou l'un en a un |
| `idle` · `submitting` · `submitted` | un seul à la fois | où en est la soumission |
| `loading` | cumulé | un champ monté, ou une ligne, a un travail en cours |
| `touched` | cumulé | au moins un champ a été touché |

```ts
form.snapshot.hasFlag("valid", "idle")   // nothing blocks, and the form is neither submitting nor already submitted
```

:::caution `submitted` reste jusqu'à `reset()`
Après un `submit()` réussi, le formulaire passe à `submitted` et **y reste** —
modifier un champ ensuite ne le ramène pas à `idle`. Seul `form.reset()` le
fait. Un bouton gardé par `!hasFlag("valid", "idle")` reste donc désactivé après
le premier envoi réussi, sauf si vous réinitialisez le formulaire. Choisissez la
garde qui correspond à votre parcours dans
[Soumettre un formulaire](../guides/submit.md#which-guard-for-the-button).
:::

Le vocabulaire du formulaire est **fermé** : vos propres flags vivent sur les
champs, et `form.snapshot.hasFlag("skeleton")` (ou
`useForm().hasFlag("skeleton")`) ne compile pas. Pour afficher un état propre à
tout le formulaire, posez le flag sur un champ et lisez ce champ.

## Deux sortes de groupes

Un simple ensemble de flags permettrait des états impossibles — `pristine`
**et** `error` en même temps. Les flags sont donc de deux sortes :

- **un seul à la fois** (exclusifs) : `pristine` · `valid` · `error`, et
  `idle` · `loading`. En poser un remplace l'autre, et la liste des mots est
  fixe.
- **cumulés** : tous les autres. Ils s'additionnent, et un flag absent vaut sa
  valeur par défaut. Si trois behaviors parlent en même temps, un seul `lock()`
  suffit à verrouiller le champ.

C'est aussi ce qui donne un sens précis à « retirer un flag » : dans un groupe
exclusif, on **remplace** le mot ; pour un flag cumulé, on **cesse de le
poser**.

## Vos propres mots

Un behavior peut publier un mot que le moteur ne connaît pas —
`mark("skeleton")` — et la vue le lit avec `hasFlag("skeleton")`. Le moteur le
transporte sans avoir à l'apprendre. Voir
[Vos propres flags](../guides/your-own-flags.md).

Les mots du moteur sont **refusés** sur ce chemin : `mark("error")` lève une
erreur. Sinon, un behavior pourrait publier l'état impossible que les groupes
existent pour empêcher.

## Pas de booléens `isX`

Il n'y a pas de `isVisible`, pas de `isLoading`, pas de `showError`. Si vous avez
besoin d'un `isX`, c'est que le flag dont vous avez besoin manque ou est mal
nommé — ce n'est pas un accesseur à ajouter.

La raison est pratique : une version antérieure a livré l'API par flags *et*
sept booléens dérivés dans le même changement. Tout le monde a utilisé les
booléens, et les flags n'ont jamais été lus.

## Affiché contre vrai {#displayed-versus-true}

C'est la seule distinction à garder en tête :

- sur un **champ**, `error` est ce qu'on **affiche**. Il reste éteint tant que le
  champ n'a pas été touché, si bien qu'une valeur préremplie n'allume jamais
  d'erreur d'elle-même ;
- sur un **formulaire**, `error` est ce qui est **vrai** : un formulaire
  prérempli avec une valeur invalide ne part pas, même si aucun champ n'affiche
  encore d'erreur.

Pour savoir si la valeur d'un champ est refusée, indépendamment de l'affichage,
lisez ses `errors` :

```ts
field.hasFlag("error")              // is there something to show the user?
field.snapshot.errors.length > 0    // is this value refused?
```

`form.submit()` touche tous les champs montés : après une soumission refusée,
les erreurs s'affichent donc là où elles doivent.
