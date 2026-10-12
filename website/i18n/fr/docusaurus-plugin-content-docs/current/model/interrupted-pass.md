---
id: interrupted-pass
title: Quand la validation ne peut pas aboutir
sidebar_position: 3
description: Gérer une vérification indisponible et comprendre la fin de l'état de chargement.
---

# Quand la validation ne peut pas aboutir

Cette page explique ce qui se passe quand une vérification de validation ne peut pas aboutir et comment traiter un service indisponible. Elle explique aussi comment un behavior personnalisé conserve ou libère son état de chargement.

Un validator vérifie la valeur d'un champ et rassemble des constats dans un `ValidationReport`. Un constat est un message de gravité `error` ou `warning`, avec un code facultatif. Une exécution de validation correspond à une exécution de ces vérifications pour la valeur actuelle.

Une vérification de format d'email peut par exemple aboutir alors qu'une requête de disponibilité séparée échoue. Les messages de la vérification terminée restent utiles, mais il faut aussi tenir compte de la requête en échec.

## Résultats après un échec asynchrone

Quand la promesse d'un validator rejette, ou qu'un membre d'un validator composite lève une exception, le rapport est marqué comme interrompu. Un validator composite rassemble plusieurs validators sur un champ.

| Résultat de l'exécution | Issues publiées |
|---|---|
| toutes les vérifications aboutissent | constats collectés ; `valid` en l'absence d'erreur |
| une vérification échoue et une autre a signalé une erreur | constats collectés, dont l'erreur bloquante |
| une vérification échoue et aucune erreur n'a été signalée | constats collectés et un constat bloquant avec `code: "unverified"` |

`unverified` identifie un constat par sa propriété `code` dans `field.issues`. Son message est `Validation unavailable`. Il bloque la soumission parce que les vérifications n'ont pas pu établir que la valeur était acceptable. Ces chemins d'échec remplacent le résultat de validation précédent au lieu d'accepter la valeur sur la seule absence d'erreurs.

:::warning Validators synchrones isolés
Une exception synchrone levée par un validator associé seul à un champ suit actuellement un autre chemin. Le champ l'intercepte, l'enregistre dans `form.engineErrors` avec `scope: "behavior"` et peut conserver l'état de validation précédent. Ce chemin ne garantit pas de constat `unverified`. Interceptez les échecs attendus dans la règle et signalez explicitement le résultat. Voir [Les erreurs du moteur](../guides/engine-errors.md).
:::

## Autoriser une vérification indisponible

Si un service indisponible doit produire un avertissement et autoriser la soumission, interceptez cet échec dans la règle. Ici, la vérification de disponibilité signale un avertissement quand le service échoue :

```ts
protected async validate(value: string, report: ValidationReport) {
    try {
        const taken = await isTaken(value);
        report.errorIf(taken, "Déjà pris", { code: "taken" });
    } catch {
        report.warn("Vérification indisponible", { code: "offline" });
    }
}
```

Cette règle se termine normalement avec un avertissement non bloquant. La soumission peut réussir si les autres règles ne signalent pas d'erreur bloquante. Utilisez plutôt `report.error(...)` dans le catch si l'échec du service doit bloquer le formulaire.

## Le chargement dans les behaviors personnalisés

Un behavior réagit aux événements du champ et peut publier un état avec `ctx.push` ou renvoyer un `BehaviorState`. `BehaviorState` décrit l'activité et les flags de ce behavior, que le contrôleur combine avec les autres sources. Le flag `loading` indique une opération en attente ; le validator peut aussi le fournir.

Une promesse renvoyée par un behavior ne publie pas automatiquement `loading`. Le behavior le demande avec `ctx.state.loading()`. Pour chaque appel de behavior, le contrôleur suit si cet appel contribue encore au chargement :

- Un appel qui renvoie `ctx.state.idle()` libère sa propre attente. D'autres appels ou validators peuvent garder le champ `loading`.
- Pour un hook asynchrone, le chargement publié pendant l'appel se termine avec sa promesse, sauf si sa valeur de retour demande explicitement `loading` de nouveau.
- Un hook synchrone peut publier un chargement pour une opération qu'il lance en dehors de sa valeur de retour. Il doit ensuite publier idle quand cette opération se termine.

```ts
onChange: async (ctx) => {
    ctx.push(ctx.state.loading());
    await préparer();
    envoyerEnTâcheDeFond();
    return ctx.state.loading();   // sinon l'attente retombe avec la promesse
},
```

Dans cet exemple, le `loading()` explicite de la valeur de retour maintient le chargement pour la tâche de fond. Cette tâche doit ensuite appeler `ctx.push(ctx.state.idle())` pour le libérer. `ctx.state` lit la contribution d'état actuelle de ce behavior, y compris après un `await`.
