---
id: hooks
title: Les hooks
sidebar_position: 2
description: Lire l'état des champs et du formulaire avec les abonnements React.
---

# Les hooks

Cette page explique quel hook React utiliser pour un champ, un formulaire ou une liste. Vous verrez comment lire les flags et les messages, et limiter les abonnements à l'état dont un composant a besoin.

Un contrôleur de champ gère un champ ; un contrôleur de formulaire gère ses champs et ses listes. Un snapshot est un objet qui décrit l'état actuel. Les hooks lisent les snapshots via `useSyncExternalStore` et relient le montage des champs et des listes aux effets React.

`useField`, `useForm` et `useFieldArray` ci-dessous sont les hooks renvoyés par `hooksFor(form)`. `useFieldOn` et `useFieldArrayOn` sont des exports directs auxquels vous fournissez un contrôleur.

| API | Rôle |
|---|---|
| `hooksFor(form)` | crée `useField`, `useFieldArray` et `useForm` liés à un formulaire et typés depuis sa map |
| `useField` | s'abonne à un champ ; renvoie valeur, constats, flags et handlers d'interaction |
| `useForm` | s'abonne au formulaire entier ; renvoie `snapshot`, `values`, `errors`, flags, `submit` et `reset` |
| `useFieldArray` | s'abonne à la composition des lignes ; renvoie `rows`, `append`, `remove`, `move` et `clear` |
| `useFieldOn(form, params)` | relie un champ au formulaire fourni, dont celui d'une ligne |
| `useFieldArrayOn(form, name)` | relie une liste au formulaire fourni, dont une liste imbriquée |
| `FormProvider` | rend un `FormRegister` disponible via le contexte React |
| `useFormRegister` | récupère ce registre |

La map associe les noms de champs aux types de valeurs. `FormRegister` conserve des contrôleurs de formulaires nommés pour les composants qui ont besoin d'accéder à plusieurs formulaires. Les hooks liés avec `hooksFor` n'ont pas besoin de son provider.

## Lire les flags

Un flag est un état nommé, comme `locked` ou `loading`. `hasFlag` exige tous les flags demandés ; `hasAny` en exige au moins un :

```tsx
field.hasFlag("locked", "required")   // ET  — toutes présentes
field.hasAny("loading", "invisible")  // OU  — au moins une
```

`useForm` propose les mêmes fonctions pour les flags du formulaire :

```tsx
const { hasFlag, submit } = useForm();

<button disabled={!hasFlag("valid", "idle")} onClick={() => void submit()}>
    Envoyer
</button>
```

`valid` signifie que le formulaire n'a pas d'erreur bloquante. Au niveau du formulaire, `idle` décrit le statut de soumission et peut coexister avec `loading`. `submit()` valide et attend les opérations concernées avant de renvoyer un booléen ; votre application gère l'envoi des valeurs. Voir [Lire les flags](../model/flags.md) pour le vocabulaire et les règles de combinaison.

:::note Afficher les erreurs après une interaction
Un validator vérifie les valeurs et signale des erreurs ou des avertissements. Le flag `error` du champ dépend des interactions : un champ prérempli sans interaction reste `pristine`, même si la validation a trouvé des erreurs. `field.errors` contient les messages bloquants indépendamment des interactions. Le formulaire utilise ces messages pour calculer la validité ; un formulaire prérempli invalide peut donc bloquer la soumission avant d'afficher les erreurs des champs.
:::

## Choisir où afficher les messages

Un constat est un message de validation avec une `severity` et un `code` facultatif. Lisez `field.issues` pour choisir les messages à afficher sous un input, dans un toast ou ailleurs :

```tsx
const toasts = field.issues.filter((issue) => issue.code === "toast");
```

Les avertissements sont non bloquants et figurent aussi dans `field.warnings`. Le moteur fournit les messages ; votre vue choisit leur présentation.

## La disponibilité des inputs

Utilisez `locked` pour piloter l'état désactivé d'un input et `readonly` pour une présentation en lecture seule qui peut encore permettre de lire et de sélectionner son texte. `readonly` n'implique pas `locked`.

La vue peut fournir les deux avec `useField({ name, locked, readOnly })`. Un behavior, qui réagit aux événements du champ et peut modifier sa disponibilité, peut aussi fournir ces flags. Retirer le verrou de la vue ne retire pas celui d'un behavior. Reliez les flags aux attributs HTML pris en charge par votre input.

## Les abonnements et les rendus

`useField` s'abonne au snapshot du champ sans le copier dans un `useState`. Un changement sur un champ indépendant ne notifie pas cet abonnement. Les champs qui s'observent peuvent se mettre à jour par leurs dépendances, et un rendu de parent React peut encore provoquer le rendu de ses enfants.

Utilisez `useForm` pour un bouton d'envoi ou un récapitulatif qui a besoin de l'état du formulaire entier. Un composant qui l'utilise reçoit les mises à jour quand le snapshot du formulaire change. Garder cet abonnement en dehors des composants de champs ordinaires évite des mises à jour inutiles venant d'inputs indépendants.

Les compteurs par champ de la démo permettent d'examiner les rendus de la version avec moteur et de la même vue implémentée avec `useState`.
