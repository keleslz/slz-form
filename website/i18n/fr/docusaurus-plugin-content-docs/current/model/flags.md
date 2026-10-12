---
id: flags
title: Lire les flags
sidebar_position: 1
description: Lire le chargement, la validité et les interactions des champs et du formulaire.
---

# Lire les flags

Utilisez les flags pour désactiver un input, afficher un indicateur de chargement ou montrer une erreur de validation. Cette page explique les flags disponibles, leur combinaison et la différence entre l'état d'un champ et celui du formulaire.

Un flag est un état nommé, comme `loading` ou `locked`. Les valeurs, les options et les messages restent des propriétés de données. `hasFlag` vérifie que tous les flags demandés sont présents ; `hasAny` vérifie qu'au moins l'un d'eux est présent.

```ts
field.hasFlag("loading", "invisible")   // ET  — toutes présentes
field.hasAny("locked", "readonly")      // OU  — au moins une
```

Vous pouvez par exemple désactiver un bouton d'envoi selon les flags du formulaire :

```tsx
<button disabled={!form.hasFlag("valid", "idle")}>Envoyer</button>
```

## Le vocabulaire

Un validator vérifie les valeurs et signale des erreurs ou des avertissements. Un behavior réagit aux événements du champ et peut modifier ses valeurs, ses options ou sa disponibilité. Le contrôleur de champ stocke ces résultats et enregistre les interactions et le cycle de vie.

| Flag | Signification | Source |
|---|---|---|
| `pristine` · `valid` · `error` | un seul état de validité affichée à la fois ; `pristine` jusqu'à une interaction | résultat du validator, affiché selon l'état `touched` du contrôleur |
| `idle` · `loading` | un seul état d'activité à la fois | behaviors et validator |
| `locked` · `readonly` · `invisible` | input désactivé, en lecture seule, champ masqué ; peuvent coexister | behaviors ; le contrôleur ajoute aussi des verrouillages et la lecture seule demandée par la vue |
| `required` · `touched` · `focused` · `mounted` · `submitting` | champ obligatoire, interaction utilisateur, focus, cycle de vie actif, soumission | contrôleur |
| les flags de votre application | états supplémentaires comme `skeleton` | behaviors via `ctx.state.mark(...)` |

Un formulaire propose aussi `hasFlag` et `hasAny`. Ses flags sont `valid` ou `error`, son statut de soumission (`idle`, `submitting` ou `submitted`), ainsi que les flags agrégés `loading` et `touched`.

```ts
form.getSnapshot().hasFlag("valid", "idle");   // la soumission peut partir
```

Au niveau du formulaire, `idle` décrit le statut de soumission. Il peut coexister avec `loading`, qui indique qu'un champ monté ou une ligne a une opération en attente. `submit()` attend les opérations concernées et vérifie la validité avant de signaler un succès. Cette méthode n'envoie pas les valeurs à un serveur.

## Comment les flags se combinent

Un champ possède exactement un flag de chaque groupe exclusif : validité affichée et activité. Il ne peut pas porter à la fois `pristine` et `error`, ni `idle` et `loading`.

Les autres flags sont cumulatifs : chaque source fournit ses flags, et le contrôleur les rassemble. Si le chargement des modèles et la soumission verrouillent tous deux le champ du modèle, la fin du chargement retire uniquement le verrou de ce behavior. Le champ reste verrouillé jusqu'à ce que toutes les sources aient retiré leur verrou.

Dans un groupe exclusif, définir un nouvel état remplace le précédent. Pour un flag cumulatif, le retirer signifie qu'une source cesse de le fournir.

## Ajouter un flag applicatif

Un behavior peut publier `mark("skeleton")` pour que votre vue lise `hasFlag("skeleton")`. Vous ajoutez ainsi un état applicatif sans modifier le moteur. Voir [Vos propres flags](../guides/your-own-flags.md).

Les flags réservés comme `error` ne peuvent pas être définis ainsi : `mark("error")` lève une exception. La validité et l'activité utilisent leurs propres API. Les flags de disponibilité comme `locked`, `readonly` et `invisible` sont autorisés.

## Lire l'état dans les composants

Utilisez `hasFlag` et `hasAny` pour les conditions d'affichage. L'API de lecture du champ ne fournit pas de helpers comme `isLoading` ou `showError`. Si votre application a besoin d'un autre état nommé, un flag personnalisé lui permet d'utiliser les mêmes fonctions de lecture.

Un snapshot est un objet qui contient les flags et les données actuels. Il conserve la même référence tant que l'état publié par le contrôleur ne change pas, ce qui permet aux composants de s'y abonner.

## Afficher les erreurs et bloquer la soumission

Un champ sans interaction reste `pristine`, même si la validation a trouvé des erreurs. Un code postal prérempli peut donc porter une erreur bloquante sans afficher de message pour le moment. `change`, `blur` et la soumission du champ le marquent `touched`, ce qui permet à la validité affichée de devenir `valid` ou `error`.

`field.errors` contient les messages bloquants indépendamment des interactions. Une fois la validation terminée, un tableau non vide indique que le champ a échoué à une vérification. Pendant une validation, lisez aussi `loading` : un tableau vide ne signifie pas à lui seul que la nouvelle vérification est terminée.

```ts
field.hasFlag("error")       // faut-il montrer quelque chose à l'utilisateur ?
field.errors.length > 0      // cette valeur est-elle refusée ?
```

Le formulaire utilise les messages bloquants pour calculer sa validité, même avant une interaction. Les champs montés et visibles participent à ce calcul ; les champs masqués ne le bloquent pas. Les listes y ajoutent aussi les erreurs de leurs lignes. Un formulaire prérempli invalide peut donc être `error` alors que ses champs restent `pristine`.
