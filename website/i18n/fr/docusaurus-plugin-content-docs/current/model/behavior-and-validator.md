---
id: behavior-and-validator
title: Behavior ou Validator ?
sidebar_position: 2
description: Un behavior réagit, un validator juge. Ce que chacun peut faire, les hooks que reçoit un behavior, et comment choisir.
---

# Behavior ou Validator ?

Tout ce que vous branchez sur un champ est l'une de deux choses :

- un **behavior** réagit — il remplit la valeur, charge des options, pose
  `loading`, `locked`, `readonly` ou `invisible` ;
- un **validator** juge — il dit si la valeur est acceptée. C'est la **seule**
  source de validité.

| | Validator | Behavior |
|---|---|---|
| Question à laquelle il répond | « cette valeur est-elle acceptable ? » | « que doit-il se passer quand… ? » |
| Ce qu'il produit | des constats : `message`, `severity`, `code` | des flags sur son propre champ |
| Écrit la valeur | non | oui — **celle de son propre champ** uniquement |
| Effet sur la soumission | direct : un constat bloquant l'arrête | indirect : `submit()` attend la fin de son travail asynchrone |

Règle simple : si la question est « **est-ce valide ?** », écrivez un validator.
Si c'est « **que doit-il se passer ?** », écrivez un behavior.

L'objectif derrière ce partage : ce que vous feriez avec `useState` et
`useEffect` devrait être faisable avec un behavior ou un validator, sans
modifier le moteur. `packages/form/test/parity.test.ts` vérifie 11 de ces cas —
validation croisée, `required` conditionnel, erreurs serveur, skeleton de
chargement… — et n'attrape jamais le `FormController` depuis l'un d'eux.

C'est un objectif, pas une garantie : certains besoins restent hors d'atteinte
par ce chemin. Retirer un champ du payload depuis une règle, une ligne qui lit
son formulaire parent, un flag propre à tout le formulaire, réagir à n'importe
quel changement dans un ensemble de champs inconnu à l'avance, et être prévenu
des erreurs du moteur au moment où elles arrivent demandent aujourd'hui du code
dans la vue. Voir [Un formulaire, un graphe](../guides/dependencies.md#one-form-one-graph)
et [Sur un champ, pas sur le formulaire](../guides/your-own-flags.md#on-a-field-not-on-the-form).

## Pourquoi la validité n'est pas partagée

Si un behavior pouvait écrire la validité, deux sources pourraient se
contredire, et il n'existe aucune bonne façon de les départager. Garder un seul
juge est ce qui rend les flags fiables : `valid` veut dire qu'un validator a
tranché, pas qu'un composant l'a décidé.

Le validator reçoit donc ce qu'il lui faut pour juger — jamais de quoi écrire :

- **une lecture des autres champs** : il les déclare dans `watch` et les lit
  avec `ctx.watched(name)` ;
- **un moyen de se faire relancer** : dans une sous-classe de validator,
  `this.requestRevalidation()` le relance quand son verdict peut changer alors
  que la valeur n'a pas bougé — c'est ainsi qu'`ExternalValidator` applique les
  erreurs du serveur.

| Besoin | Comment |
|---|---|
| Confirmer un mot de passe, comparer deux dates | le validator déclare `watch` et lit `ctx.watched(...)` |
| `required` dans certains cas seulement | le validator décide, avec `validateWhenEmpty = true` |
| Une erreur renvoyée par le serveur | un `ExternalValidator`, à côté de vos règles : `validator: [rules, serverIssues]` |
| Rejuger sans nouvelle frappe | `this.requestRevalidation()` depuis le validator |
| Un avertissement qui ne bloque pas | `report.warn(...)` |
| Afficher un message dans un toast plutôt que sous le champ | `report.error(message, { code })`, et la vue route sur `code` |
| Verrouiller un champ tant qu'un autre n'est pas valide | `lockUntilValid({ watch })` |
| Lignes de facture, listes dynamiques | `form.array("lines")` — [une ligne est un formulaire](a-row-is-a-form.md) |

Écrire des validators : [Valider](../guides/validate.md).

## Écrire un behavior

Un behavior est un objet simple (ou une instance de la classe de base
`Behavior`) avec des **hooks** facultatifs — des fonctions que le moteur appelle
à un moment de la vie du champ :

| Hook | Appelé quand |
|---|---|
| `onMount(ctx)` | le champ est monté, et à nouveau lors d'un `reset()` |
| `onChange(ctx, value)` | la valeur du champ a changé — par l'utilisateur **ou** par du code (voir l'avertissement ci-dessous) |
| `onFocus(ctx)` / `onBlur(ctx)` | la saisie prend ou perd le focus |
| `onSubmit(ctx)` | le formulaire est en cours de soumission |
| `onDependencyChanged(ctx, dependency)` | un champ listé dans `watch` a changé — sa valeur, par défaut ([détails](../guides/dependencies.md)) |
| `onUnmount(ctx)` | le champ est démonté — c'est l'endroit pour nettoyer ; les écritures y sont ignorées |

Un hook renvoie les flags que le behavior veut sur le champ — un
`BehaviorState`, construit à partir de `ctx.state` —, ou une promesse d'un tel
état, ou rien (« pas de changement »).

```ts
import type { IBehavior } from "slz-form";

const lockedWhileEmpty: IBehavior<string> = {
    onMount: (ctx) => (ctx.getValue() ? ctx.state.unlock() : ctx.state.lock()),
    onChange: (ctx, value) => (value ? ctx.state.unlock() : ctx.state.lock()),
};
```

`ctx`, c'est ce que reçoit un hook :

| Membre | Ce que c'est |
|---|---|
| `ctx.name` | le nom du champ auquel le behavior est attaché |
| `ctx.state` | les flags que **ce behavior** pose en ce moment, sous forme de `BehaviorState`. Ses méthodes rendent un nouvel état : `loading()`, `idle()`, `lock()`, `unlock()`, `readOnly()`, `writable()`, `hide()`, `show()`, `mark(word)`, `unmark(word)`, `clear()` |
| `ctx.push(state)` | publie un état **tout de suite**, avant que le hook ne rende la main — la façon d'afficher `loading` pendant un `await` |
| `ctx.getValue()` / `ctx.setValue(value)` | lit ou écrit la valeur de ce champ. `setValue` ne marque pas le champ touché |
| `ctx.clear()` | vide la valeur **et** rend le champ à nouveau non touché, pour qu'aucune erreur « obligatoire » n'apparaisse pour un effacement que l'utilisateur n'a pas fait |
| `ctx.setOptions(options)` | publie la liste d'options (select, radio…) |
| `ctx.watched(name)` | lit un champ déclaré dans `watch` : `value`, `errors`, `hasFlag(...)`. Lève une erreur pour un nom non déclaré |
| `ctx.ui` | les flags fusionnés du champ — tout ce que disent les behaviors et le validator |
| `ctx.form` | une lecture du formulaire : `name`, `status`, `field(name)`, `values()` |
| `ctx.signal` | un `AbortSignal` avorté au démontage du champ — passez-le à `fetch`, vérifiez-le après chaque `await` |

:::caution `onChange` se déclenche aussi sur les écritures par code
`onChange` signifie « la valeur a changé », pas « l'utilisateur a tapé ». Il
s'exécute pour `field.change()`, mais aussi pour `ctx.setValue()`, `ctx.clear()`
et `field.update({ value })` — un prefill ou un lookup déclenche donc le
`onChange` des autres behaviors du champ. Le hook ne sait pas d'où vient
l'écriture ; le signal le plus proche est `ctx.ui.hasFlag("touched")`, qui dit
si l'utilisateur a interagi avec le champ, une fois au moins.
:::

:::caution `ctx.form` est une lecture ponctuelle
`ctx.form.field(name)` et `ctx.form.values()` lisent n'importe quel champ sans
vérifier `watch`, et rien ne relance votre hook quand ce que vous avez lu
change. Utilisez `ctx.watched(name)` pour tout ce dont vous dépendez ; gardez
`ctx.form` pour des lectures ponctuelles, comme le `name` du formulaire.
:::

## Un behavior ne garde aucun état de champ

Un behavior *rend* ses flags ; c'est le champ qui les range. Une instance peut
porter de la **configuration** — une URL, un délai — mais jamais l'état d'un
champ. C'est ce qui permet de partager une même instance entre plusieurs
champs :

```ts
const prefillFromProfile = prefill(fetchProfileDefault);

form.field("shipTo", { behaviors: [prefillFromProfile] });
form.field("billTo", { behaviors: [prefillFromProfile] });
```

Une instance de **validator**, elle, porte le verdict de son champ : donner la
même instance à deux champs lève une erreur à la création du second. Créez-en
une par champ.

## Un champ lit ses voisins, il ne leur écrit jamais

Un champ est la source de vérité pour lui-même et pour rien d'autre. Pour
remplir `city` à partir de `postcode`, le behavior se pose sur `city` et observe
`postcode` — jamais l'inverse. Voir
[Dépendances déclarées](../guides/dependencies.md).
