---
id: behavior-and-validator
title: Behaviors et validators
sidebar_position: 2
description: Choisir où écrire les mises à jour de valeur, les règles de disponibilité et la validation.
---

# Behaviors et validators

Cette page explique où écrire les règles de chargement, de verrouillage et de validation. Vous pourrez choisir un behavior ou un validator pour chaque partie d'un formulaire.

Un behavior réagit à un événement de champ et peut modifier la valeur, les options ou les flags de ce champ. Un flag est un état nommé, comme `loading` ou `locked`. Un validator vérifie une valeur et signale des constats : des messages avec une gravité et un code facultatif.

Dans un formulaire de voiture, charger les modèles après un changement de marque relève d'un behavior. Vérifier le format d'un code postal relève d'un validator.

| | Validator | Behavior |
|---|---|---|
| Rôle | vérifier une valeur | réagir à un événement |
| Résultat | constats avec `severity`, `message`, `code` | un `BehaviorState` décrivant l'activité et la disponibilité |
| Modifie la valeur | aucune API de modification dans son contexte | peut modifier son propre champ |
| Soumission | les constats de gravité `error` la bloquent | `submit()` attend les opérations concernées en attente |

`BehaviorState` contient la contribution d'un behavior à l'état du champ. Le contrôleur stocke et combine ces contributions ; le résultat d'un behavior ne comporte aucun réglage de validité.

## Une validation qui dépend d'autres données

Un validator peut lire d'autres champs en les déclarant dans `watch` et en appelant `ctx.watched(...)`. `watch` enregistre la dépendance pour qu'un changement déclenche une nouvelle validation. Les règles du code postal peuvent par exemple dépendre du pays sélectionné.

Un validator peut aussi appeler la méthode protégée `requestRevalidation()` quand ses règles doivent être exécutées de nouveau sans changement de valeur. `ExternalValidator` l'utilise quand de nouveaux constats arrivent du serveur.

| Besoin | API |
|---|---|
| Confirmer un mot de passe ou comparer des dates | déclarer `watch`, puis lire `ctx.watched(...)` |
| Exiger une valeur sous une condition | vérifier la condition dans un validator avec `validateWhenEmpty` |
| Afficher une erreur de validation du serveur | composer `ExternalValidator` avec les validators locaux |
| Revérifier sans changement de valeur | appeler `requestRevalidation()` dans un validator |
| Signaler un avertissement non bloquant | `report.warn(...)` |
| Afficher un message dans une snackbar | associer un `code` avec `report.error(msg, { code })`, puis le lire dans la vue |
| Verrouiller tant qu'un autre champ porte des erreurs bloquantes | `lockUntilValid({ watch })` |
| Gérer des lignes de facture | `form.array("lines")`, chaque ligne ayant son formulaire |

`validateWhenEmpty` permet à votre règle de s'exécuter quand le champ n'a pas de valeur. Sans cette option, le validator de base traite `required` et ignore votre règle personnalisée sur les valeurs vides.

## Conserver l'état du behavior sur le contrôleur

Renvoyez une contribution d'état, ou publiez-la avec `ctx.push`, et laissez le contrôleur la stocker. Si vous souhaitez partager une instance de behavior, conservez l'état propre à chaque champ en dehors de cette instance. Sinon, deux champs qui l'utilisent pourraient modifier leur état mutuellement.

```ts
// Chaque champ conserve sa propre valeur préremplie.
const prefillFromProfile = prefill(fetchProfileDefault);

form.field("shipTo", { behaviors: [prefillFromProfile] });
form.field("billTo", { behaviors: [prefillFromProfile] });
```

Le helper de préremplissage fourni conserve la valeur obtenue sur chaque contrôleur de champ. Vous pouvez donc le réutiliser pour la livraison et la facturation sans partager leurs valeurs. `prefill` est un behavior qui charge une valeur au montage du champ.

## Lire les autres champs

Le contexte fournit au behavior des méthodes pour modifier son propre champ et des vues en lecture seule des autres champs. Le champ du modèle peut par exemple lire la marque et recharger ses propres options. Il ne reçoit pas de méthode pour modifier la marque.

Utilisez `watch` pour les changements qui doivent déclencher une réaction. Lire le formulaire entier via `ctx.form` ne crée pas automatiquement d'abonnement aux changements. Voir [Dépendances déclarées](../guides/dependencies.md).
