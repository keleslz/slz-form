---
id: behavior-et-validator
title: Behavior ou Validator ?
sidebar_position: 2
description: Le réacteur a une sonnette, le juge a des yeux — et l'autorité ne se partage pas.
---

# Behavior ou Validator ?

Le parti pris central : **rien de ce qu'on sait faire avec `useState` et un
`useEffect` ne doit être impossible ici**, et rien ne doit obliger à modifier le
moteur.

Le partage des rôles est net. Le **behavior** réagit — il écrit une valeur,
publie des options, émet `loading`, `locked`, `readonly`, `invisible`. Le
**validator** juge — il est la seule autorité sur la validité.

| | Validator | Behavior |
|---|---|---|
| Sémantique | « cette valeur est-elle acceptable ? » | « que se passe-t-il quand… ? » |
| Sortie | des constats : `severity`, `message`, `code` | une tranche d'état : activité, disponibilité |
| Écrit la valeur | non | oui, **la sienne** |
| Impact sur la soumission | direct — un constat bloquant l'empêche | indirect — `submit()` attend son travail asynchrone |

Règle simple : si la question est « **est-ce valide ?** », c'est un validator.
Si c'est « **que doit-il se passer ?** », c'est un behavior.

## Pourquoi l'autorité ne se partage pas

Si un behavior pouvait écrire la validité, il faudrait arbitrer entre deux
sources qui ne sont pas d'accord — et cet arbitrage n'a pas de bonne réponse.
C'est ce qui rend les flags dignes de confiance : `valid` veut dire qu'un juge
s'est prononcé, pas qu'un composant l'a décrété.

Pour que la séparation tienne sans rien rendre impossible, le juge a des
**yeux** et le réacteur une **sonnette** :

| Besoin | Comment |
|---|---|
| Confirmer un mot de passe, ordonner deux dates | le validator déclare `watch` et lit `ctx.watched(...)` |
| `required` seulement dans certains cas | le validator décide, avec `validateWhenEmpty` |
| Une erreur renvoyée par le serveur | `ExternalValidator`, composé avec les règles métier |
| Un avertissement qui ne bloque pas | `report.warn(...)` |
| Router un message vers une snackbar | `report.error(msg, { code })`, et la vue lit `code` |
| Verrouiller tant qu'un autre champ n'est pas valide | `lockUntilValid({ watch })` |
| Lignes de facture, listes dynamiques | `form.array("lines")` — une ligne est un formulaire |

Ce critère est vérifié, pas affirmé : `packages/form/test/parity.test.ts`
reprend chaque cas et l'écrit avec un behavior ou un validator, **sans jamais
capturer le `FormController`**. Un cas qui n'y arriverait qu'en capturant le
formulaire ne serait pas couvert — il serait contourné.

## Un behavior ne porte pas d'état

Il *retourne* sa tranche d'état ; le contrôleur la range. Une instance porte de
la **configuration** — une URL, un debounce —, jamais de l'état, sinon la
partager entre deux champs les coupleraient.

```ts
// ✓ partageable : ne porte que sa configuration
const prefillRef = prefill({ field: "customerReference", fetch: fetchReference });

form.field("a", { behaviors: [prefillRef] });
form.field("b", { behaviors: [prefillRef] });
```

## Un champ lit, il n'écrit jamais chez le voisin

Un champ est source de vérité pour lui-même et pour rien d'autre. Verrouillages,
masquages et rechargements croisés passent tous par une **lecture** déclarée,
sans mutation. Voir [Dépendances déclarées](../guides/dependances.md).
