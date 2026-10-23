---
id: index
title: slz-form
sidebar_label: Vue d'ensemble
sidebar_position: 0
description: Un moteur de formulaires TypeScript, indépendant de tout framework, où l'UI est pilotée par des flags.
---

# slz-form

:::warning Pré-publication
Les packages se construisent et passent leurs tests, mais **rien n'est encore
sur npm**. L'API peut encore changer.
:::

slz-form est un moteur de formulaires écrit en TypeScript, sans aucun framework
à l'intérieur. Vous déclarez vos champs, les réactions que vous leur branchez et
les règles qui les jugent. Le moteur porte les valeurs, les états d'interface et
les liens entre champs. Vos composants se contentent de lire un état et de
l'afficher.

## Pourquoi

Un formulaire est rarement difficile à cause de ses valeurs. Il l'est à cause de
tout ce qui les entoure : un champ verrouillé pendant un appel réseau, un autre
masqué tant qu'une case n'est pas cochée, une erreur qui s'affiche quand
l'utilisateur quitte le champ mais jamais sur une valeur préremplie, un bouton
grisé tant que le formulaire est invalide ou en cours d'envoi. Cette logique
finit d'ordinaire dans la vue, en booléens recalculés à la main :

```tsx
<input disabled={loading || submitting || !brand || readOnly} />
{touched && error && <p>{error}</p>}
```

Avec slz-form, le champ dit ce qu'il **est** par des flags, et ce qu'il
**contient** par des données :

```tsx
if (field.hasFlag("invisible")) return null;

<input disabled={field.hasFlag("locked")} readOnly={field.hasFlag("readonly")} />
{field.hasFlag("loading") && <Spinner />}
{field.hasFlag("error") && <p>{field.error}</p>}
```

Deux fonctions lisent tous les états, sur un champ comme sur un formulaire :
`hasFlag(...)` est un **ET** (tous les flags sont présents), `hasAny(...)` un
**OU** (au moins un l'est). Il n'y a rien d'autre à apprendre pour lire l'état.

## Vocabulaire {#vocabulary}

Les mots ci-dessous reviennent sur toutes les pages.

| Mot | Ce qu'il désigne |
|---|---|
| **formulaire** | un `FormController` : il crée les champs, rassemble leurs valeurs et contrôle la soumission. |
| **champ** | un `FieldController` : une saisie — sa valeur, ses interactions, ses flags, sa validité. |
| **map de champs** | le type TypeScript donné au formulaire, `{ email: string; age: number }`. Les noms de champs et les types de valeurs sont vérifiés contre lui. |
| **flag** | un mot qui décrit un état : `loading`, `locked`, `error`… On le teste avec `hasFlag` / `hasAny`. |
| **snapshot** | l'état immuable d'un champ ou d'un formulaire à un instant donné : sa valeur, ses flags, ses messages. Un nouvel objet seulement quand quelque chose a changé. |
| **behavior** | un objet qui **réagit** : il remplit une valeur, charge des options, verrouille ou masque le champ. Il ne décide jamais de la validité. |
| **validator** | une classe qui **juge** une valeur et signale des constats. C'est la seule source de validité. |
| **constat** (*issue*) | ce que signale un validator : un message, une gravité (`error` bloque, `warning` non) et un `code` facultatif. |
| **hook** | deux sens. Un **hook de behavior** est une fonction d'un behavior que le moteur appelle à un moment de la vie du champ : `onMount`, `onChange`, `onBlur`… Un **hook React** est l'une des fonctions de l'adapter : `useField`, `useForm`… |
| **`ctx`** | l'objet passé à votre code. Le `ctx` d'un hook de behavior porte les flags propres au behavior, une lecture du formulaire et des autres champs, et les méthodes qui écrivent **ce** champ. Le `ctx` d'un validator est en lecture seule : `watched(name)`, `form`, `signal`. |
| **`watch`** | la liste des autres champs qu'un behavior ou un validator lit. C'est cette déclaration qui les relance quand ces champs changent. |
| **monter** (*mount*) | faire entrer un champ dans le formulaire qu'on remplit. Seuls les champs montés comptent dans le payload et dans le verdict. |
| **payload** | `form.values()` : ce que vous envoyez. |
| **verdict** | le fait qu'une valeur, ou le formulaire entier, soit acceptée ou non. |
| **ligne** (*row*) | une entrée d'une liste répétable. Une ligne est un petit formulaire à part entière. |

## Par où commencer

| Vous voulez… | Allez à |
|---|---|
| voir ce que ça remplace | [Le problème](getting-started/the-problem.md) |
| l'installer, lancer la démo | [Installation](getting-started/installation.md) |
| écrire votre premier formulaire | [Premier formulaire](getting-started/first-form.md) |
| comprendre le modèle avant de coder | [Les flags, et les deux fonctions](model/flags.md) |
| envoyer un formulaire | [Soumettre un formulaire](guides/submit.md) |
| l'utiliser sans React | [Sans framework](guides/without-a-framework.md) |
| brancher un besoin précis | [Guides](guides/prefill.md) |
| la signature exacte d'une fonction | [Référence API](reference/slz-form/index.md) |
| savoir **pourquoi** c'est fait ainsi | [Le dossier de conception](/conception/MODEL) |

## Ce que ce n'est pas {#what-it-is-not}

- **Pas une bibliothèque de composants.** Aucun style, aucun markup : le moteur
  produit un état, le rendu est à vous. Les composants de la démo sont des
  exemples, pas l'API.
- **Pas un validateur de schéma.** Il ne remplace ni Zod ni Yup et n'invente
  aucun langage de règles. Il exécute les validators que vous écrivez — l'un
  d'eux peut appeler une bibliothèque de schéma.
- **Pas un state manager généraliste.** Il porte l'état de vos formulaires, pas
  celui de votre application, et ne se branche sur aucun store.
- **Pas une couche HTTP.** Il ne fait aucun appel réseau. Il décide quand les
  vôtres partent, ce qui est verrouillé pendant ce temps et ce que devient le
  résultat.
- **Pas un générateur de formulaires.** Aucune page rendue depuis un JSON. Vous
  écrivez votre vue.
- **Pas de masques de saisie.** Mettre en forme ce que tape l'utilisateur — un
  numéro de téléphone, de carte — revient à votre composant de saisie.
- **Pas encore de rendu serveur.** L'adapter React lit son état avec
  `useSyncExternalStore` sans `getServerSnapshot` : le rendu côté serveur lève
  une erreur.
- **Pas une surcouche de React.** Le cœur ignore l'existence de React ;
  l'adapter est mince et remplaçable.
