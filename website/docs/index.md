---
id: index
title: slz-form
sidebar_label: Vue d'ensemble
sidebar_position: 0
description: Un moteur de formulaires agnostique de tout framework, où l'UI est pilotée par des flags.
---

# slz-form

:::warning Pré-publication
Les packages sont construits et prêts, **rien n'est encore sur npm**. L'API peut
encore bouger.
:::

Un formulaire est rarement difficile à cause de ses valeurs. Il l'est à cause de
tout ce qui les entoure : un champ verrouillé pendant un appel réseau, un autre
masqué tant qu'une case n'est pas cochée, une erreur qui n'apparaît qu'après
avoir quitté le champ mais jamais sur un prefill, un bouton grisé tant que le
formulaire est invalide ou en cours d'envoi. Cette logique finit d'ordinaire
éparpillée dans la vue, en booléens recalculés à la main :

```tsx
<input disabled={loading || submitting || !brand || readOnly} />
{touched && error && <p>{error}</p>}
```

slz-form la déplace dans le moteur. **Ce qu'un champ *est* se lit en flags ; ce
qu'il *contient* se lit en données.** Le composant ne décide de rien — il lit un
état et se rend :

```tsx
if (field.hasFlag("invisible")) return null;

<input disabled={field.hasFlag("locked")} readOnly={field.hasFlag("readonly")} />
{field.hasFlag("loading") && <Spinner />}
{field.hasFlag("error") && <p>{field.error}</p>}
```

Deux fonctions lisent tous les états, au champ comme au formulaire :
`hasFlag(...)` est le **ET** — toutes présentes ; `hasAny(...)` le **OU** — au
moins une. C'est toute la surface de lecture, et c'est ce qui dissout le
`loading || submitting || !brand` ci-dessus.

```tsx
<button disabled={!form.hasFlag("valid", "idle")}>Envoyer</button>
```

## Par où commencer

| Vous voulez… | Allez à |
|---|---|
| voir ce que ça remplace | [Le problème](demarrer/le-probleme.md) |
| l'installer, lancer la démo | [Installation](demarrer/installation.md) |
| écrire votre premier formulaire | [Premier formulaire](demarrer/premier-formulaire.md) |
| comprendre le modèle avant de coder | [Les flags, et les deux fonctions](modele/flags.md) |
| brancher un besoin précis | [Guides](guides/preremplir.md) |
| la signature exacte d'une fonction | [Référence API](reference/slz-form/index.md) |
| savoir **pourquoi** c'est fait ainsi | [Le dossier de conception](/conception/MODEL) |

## Ce que ce n'est pas

- **Pas une bibliothèque de composants.** Aucun style, aucun design system,
  aucun markup imposé : le moteur produit un état, le rendu reste à vous. Les
  composants de la démo sont des exemples, pas l'API.
- **Pas un validateur de schéma.** Il ne remplace ni Zod ni Yup et n'invente pas
  de langage de règles : il orchestre les validateurs que vous écrivez — et peut
  en encapsuler un.
- **Pas un state manager généraliste.** Il gère l'état de vos formulaires, pas
  celui de votre application, et ne se branche sur aucun store.
- **Pas une couche HTTP.** Il ne fait aucun appel réseau ; il orchestre les
  vôtres — quand les lancer, quoi verrouiller pendant, quoi faire du résultat.
- **Pas un générateur de formulaires.** Pas de rendu depuis un JSON, pas de
  schéma déclaratif produisant une page. Vous écrivez votre vue.
- **Pas encore de rendu serveur.** L'adapter React lit son état via
  `useSyncExternalStore` sans `getServerSnapshot` : le rendu côté serveur lève.
- **Pas une abstraction de React.** Le cœur ignore l'existence de React ;
  l'adapter est mince et remplaçable, pas une couche de compatibilité.
