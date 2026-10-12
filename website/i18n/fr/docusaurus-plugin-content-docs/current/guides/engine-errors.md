---
id: engine-errors
title: Les erreurs du moteur
sidebar_position: 6
description: Examiner les exceptions capturées pendant les behaviors et la validation.
---

# Les erreurs du moteur

Cette page montre comment examiner les échecs capturés pendant l'exécution des behaviors et de la validation. Vous pourrez envoyer ces diagnostics à votre outil de suivi des erreurs et les distinguer des messages de validation.

Un behavior réagit aux événements de champ ; un validator vérifie les valeurs et signale des constats. Un constat est un message de validation de gravité `error` ou `warning`. Si l'exécution d'un hook ou d'une règle lève une exception ou rejette sans être traitée par votre code, les chemins d'interception du moteur enregistrent l'exception sur le formulaire au lieu de la journaliser dans la console.

```ts
if (!(await form.submit())) {
    for (const err of form.engineErrors) {
        reportToSentry(err);
    }
}
```

:::warning Lire les messages de validation
Lisez les vérifications de valeur en échec via `field.errors`, `field.issues` ou le flag `error` du champ. Un flag est un état nommé lu avec `hasFlag` ; le flag `error` du champ apparaît après une interaction. `form.engineErrors` conserve les exceptions capturées, dont les appels API en échec, plutôt que les messages ajoutés avec `report.error(...)`.
:::

## Les propriétés d'une erreur

| Propriété | Signification |
|---|---|
| `scope` | chemin d'interception : `"behavior"` ou `"validator"` |
| `kind` | `"hook-error"` ou `"guard-violation"` |
| `field` | champ où l'échec a été capturé |
| `rule` | nom du validator ou du membre de composite, lors d'une capture par le chemin validator |
| `error` | valeur levée d'origine, inchangée |
| `at` | horodatage de capture fourni par `Date.now()` |

## Le classement des erreurs

`kind` dépend du type de la valeur levée :

- `guard-violation` : une `EngineGuardError`, par exemple quand un flag réservé est défini via `mark`.
- `hook-error` : toute autre valeur levée, dont les erreurs réseau et les bugs applicatifs.

```ts
const bugs = form.engineErrors.filter((err) => err.kind === "guard-violation");
```

`EngineGuardError` est exportée. `err.error instanceof EngineGuardError` est la vérification utilisée pour le classement.

Il existe actuellement une exception au classement prévu des gardes : les lectures `ctx.watched` non déclarées dans un behavior ou un validator isolé lèvent une simple `Error` et sont enregistrées comme `hook-error`. La vérification d'un membre de validator composite lève une `EngineGuardError`, donc produit `guard-violation`. Examinez aussi le message pour diagnostiquer les déclarations de dépendances.

Les erreurs levées directement pendant la configuration d'un formulaire, comme un cycle de dépendances rejeté à l'enregistrement d'un champ, remontent à l'appelant. Elles ne passent pas par ce tampon.

## Une règle asynchrone en échec

```ts
class Available extends IValidator<string> {
    protected async validate(value: string, report: ValidationReport) {
        const taken = await api.isTaken(value);   // le réseau tombe ici
        report.errorIf(taken, "Déjà pris");
    }
}
```

Si cette requête rejette, le résultat de validation reçoit un constat bloquant avec `code: "unverified"` lorsqu'aucun autre constat bloquant n'existe. L'exception est aussi enregistrée dans `form.engineErrors` avec `scope: "validator"` et `rule: "Available"`.

Le constat indique à la vue pourquoi la soumission est bloquée ; le diagnostic conserve l'erreur sous-jacente pour l'examiner. Un validator composite conserve les messages de ses autres membres même si l'un échoue. Voir [Quand la validation ne peut pas aboutir](../model/interrupted-pass.md).

:::warning Exceptions synchrones isolées
Un validator associé seul à un champ qui lève une exception synchrone est actuellement intercepté par le chemin de secours du champ. Il est enregistré avec `scope: "behavior"`, sans `rule`, et l'état de validation précédent peut rester en place. Ne comptez pas sur ce chemin pour bloquer la soumission ; signalez les échecs attendus dans la règle.
:::

## Lire le tampon

`engineErrors` est un accesseur sans abonnement `onEngineError`. Vous pouvez le lire après un `submit()` refusé, dans un panneau de debug ou dans un test.

- Il se trouve en dehors du snapshot, l'objet utilisé pour l'état de rendu. Ajouter un diagnostic ne notifie pas à lui seul les abonnements de rendu. L'accesseur est disponible sur le contrôleur du formulaire, pas sur les vues des champs.
- Il conserve les 50 erreurs les plus récentes.
- `reset()` le vide. La soumission le conserve pour que les erreurs capturées pendant cette soumission restent lisibles.
- Chaque lecture renvoie une copie, de l'erreur la plus ancienne à la plus récente.

:::note Appeler un validator en dehors d'un formulaire
Un appel direct à `validator.handle(value)` n'a aucun formulaire pour recevoir le diagnostic. Un rejet asynchrone peut tout de même produire un constat de validation `unverified`, mais aucun enregistrement `engineErrors` n'est écrit. Une exception synchrone directe fait rejeter `handle()` ; l'appelant doit la traiter.
:::
