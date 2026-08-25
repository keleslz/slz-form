---
id: index
title: slz-form
sidebar_label: Vue d'ensemble
sidebar_position: 0
description: Un moteur de formulaires piloté par des flags, indépendant du framework.
---

# slz-form

:::warning Pré-publication
Les packages sont construits et prêts, **rien n'est encore sur npm**. L'API peut
encore bouger.
:::

Un moteur de formulaires **agnostique de tout framework**, où l'interface est
pilotée par l'état plutôt que par des conditions éparpillées dans le JSX.

```tsx
if (field.hasFlag("invisible")) return null;

<input disabled={field.hasFlag("locked")} />
{field.hasFlag("loading") && <Spinner />}
{field.hasFlag("error") && <p>{field.error}</p>}
```

Le composant ne décide de rien : il lit et se rend.

## Par où commencer

| Vous voulez… | Allez à |
|---|---|
| comprendre ce que ça remplace | [Le problème](demarrer/le-probleme.md) |
| l'installer et voir la démo tourner | [Installation](demarrer/installation.md) |
| écrire votre premier formulaire | [Premier formulaire](demarrer/premier-formulaire.md) |
| comprendre le modèle avant de coder | [Les flags, et les deux fonctions](modele/flags.md) |
| brancher un besoin précis | [Guides](guides/preremplir.md) |
| la signature exacte d'une fonction | [Référence API](reference/slz-form/index.md) |
| savoir **pourquoi** c'est fait comme ça | [Le dossier de conception](/conception/MODEL) |

## Ce que ce n'est pas

Dire ce qu'un outil ne fait pas évite d'en attendre ce qu'il ne donnera pas.

- **Pas une bibliothèque de composants.** Aucun style, aucun design system,
  aucun markup imposé. Le moteur produit un état ; le rendu reste entièrement à
  vous. Les composants de la démo sont des exemples, pas l'API.
- **Pas un validateur de schéma.** Il ne remplace ni Zod ni Yup, et n'invente
  pas de langage de règles : il orchestre les validateurs que vous écrivez — et
  peut parfaitement en encapsuler un.
- **Pas un state manager généraliste.** Il gère l'état de vos formulaires, pas
  celui de votre application, et ne se branche sur aucun store.
- **Pas une couche HTTP.** Il ne fait aucun appel réseau ; il orchestre les
  vôtres — quand les lancer, quoi verrouiller pendant, quoi faire du résultat.
- **Pas un générateur de formulaires.** Pas de rendu depuis un JSON, pas de
  schéma déclaratif produisant une page. Vous écrivez votre vue.
- **Pas un moteur de mise en forme de la saisie.** Masques de téléphone, d'IBAN
  ou de montant : la valeur affichée et la valeur stockée sont la même, et la
  position du curseur reste l'affaire de la vue.
- **Pas encore de rendu serveur.** L'adapter React lit son état via
  `useSyncExternalStore` sans `getServerSnapshot` : le rendu côté serveur lève.
- **Pas une abstraction de React.** Le cœur ignore l'existence de React.
  L'adapter est mince et remplaçable, pas une couche de compatibilité.
