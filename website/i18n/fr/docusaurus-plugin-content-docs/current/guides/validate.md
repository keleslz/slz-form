---
id: validate
title: Valider
sidebar_position: 2
description: Écrire des règles de validation, combiner leurs constats et traiter les réponses du serveur.
---

# Valider

Cette page montre comment écrire des règles de validation, lire leurs messages et combiner des vérifications locales avec des erreurs serveur. Vous verrez aussi comment différer une vérification pendant la saisie.

Un validator vérifie la valeur d'un champ et signale des constats, des messages avec une gravité et un code facultatif. Étendez `IValidator<T>` pour votre type de valeur et ajoutez les constats à `report`, le `ValidationReport` de cette exécution. Une règle asynchrone renvoie une promesse ; le champ porte le flag `loading` jusqu'à la fin de la validation. Un flag est un état nommé que votre vue peut vérifier avec `hasFlag`.

## Une règle

```ts
class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport) {
        report.errorIf(!value.includes("@"), "Adresse email invalide");
    }
}
```

Associez une instance via l'option `validator` du champ. Le validator de base traite l'option `required` du champ en complément de votre règle.

:::note Les règles sur les valeurs vides
Les règles personnalisées sont ignorées sur les valeurs vides, sauf si le validator déclare `validateWhenEmpty = true`. Les valeurs vides comprennent `undefined`, `null`, les chaînes blanches et les tableaux vides. `false` est vide uniquement avec `requiredTrue: true`. Si votre règle décide qu'un champ est obligatoire sous une condition, activez `validateWhenEmpty` et prévoyez `undefined` dans la règle.
:::

## Gravité et codes

Pour une référence client, une erreur de format peut bloquer la soumission. Pour un code postal, vous pouvez simplement avertir qu'une valeur semble inhabituelle :

```ts
report.error("Format attendu : CUST-42-9013", { code: "format" });
report.warn("Ce code postal semble inhabituel", { code: "unusual" });
```

Un constat de gravité `error` bloque la soumission ; la gravité `warning` ne la bloque pas. `code` est un identifiant applicatif facultatif qui permet de choisir où afficher ou traduire le message, par exemple sous l'input ou dans une snackbar. Le moteur le conserve sans choisir la présentation.

Lisez tous les messages et leurs métadonnées via `field.issues`, les messages bloquants via `field.errors`, et les avertissements via `field.warnings`. Le flag `error` du champ permet d'afficher les erreurs bloquantes après une interaction. Un champ prérempli est validé, mais reste `pristine` jusqu'à une interaction.

## Lire un autre champ

`watch` liste les champs dont les changements de valeur doivent relancer un validator. `ctx.watched` donne une vue en lecture seule d'un champ déclaré :

```ts
class SameAsPassword extends IValidator<string> {
    readonly watch = ["password"];
    protected validate(value: string, report: ValidationReport, ctx: ValidationContext) {
        report.errorIf(value !== ctx.watched("password")?.value, "Ne correspond pas");
    }
}
```

`ctx.watched` lève une exception pour un nom non déclaré. Il renvoie `null` si le champ déclaré est indisponible. Lire via `ctx.form` ne crée pas automatiquement de dépendance ; gardez `watch` explicite.

## Plusieurs validators sur un champ

`ExternalValidator` conserve les constats fournis par votre application, comme la réponse du serveur à un email soumis. Passez un tableau pour le combiner avec les règles locales :

```ts
const serverIssues = new ExternalValidator<string>();

form.field("email", { validator: [new EmailValidator(), serverIssues] });

// après un 422
serverIssues.set([{ message: "Déjà pris", severity: "error", code: "taken" }]);
```

Le contrôleur crée un validator composite à partir du tableau. Il exécute ses membres et rassemble leurs constats ; chaque membre conserve ses règles et ses dépendances déclarées. `set()` demande une nouvelle validation pour que les constats injectés figurent dans le résultat du champ. `clear()` les retire et demande à nouveau une validation.

Les constats injectés se rattachent à la valeur lue lors de la première validation après `set()`. Ils cessent de s'appliquer à un champ quand cette valeur change et ne reviennent pas avant un autre `set()`. Si l'utilisateur modifie le champ pendant votre requête HTTP, comparez la valeur actuelle à celle envoyée avant d'appeler `set()` : le helper ne fait pas cette comparaison pour vous. Utilisez une instance distincte d'`ExternalValidator` par champ si les constats serveur doivent être indépendants ; `set`, `clear` et `reset` affectent tous les champs partageant une instance.

## Quand une règle échoue

Un rejet asynchrone ou un membre de composite en échec conserve les erreurs bloquantes collectées, ou ajoute un constat avec `code: "unverified"` s'il n'en existe aucune. Les validators synchrones isolés suivent un autre chemin d'échec. Voir [Quand la validation ne peut pas aboutir](../model/interrupted-pass.md) pour le comportement exact et la façon de signaler explicitement une vérification indisponible.

## Différer une validation

Un debounce diffère une vérification lorsque les changements sont rapprochés. `DebouncedValidator` enveloppe un validator et attend le délai configuré avant de l'exécuter :

```ts
new DebouncedValidator(new EmailValidator(), 400);
```

Le champ devient `loading` pendant le délai et la vérification. Le contrôleur appelle `IValidator.flush()` au blur et à la soumission pour lancer immédiatement la vérification en attente, puis la soumission attend le résultat. Le `flush` de base ne fait rien ; `DebouncedValidator` l'implémente. La vérification de présence obligatoire de base n'est pas différée.

:::tip Choisir quoi différer
Utilisez `DebouncedValidator` pour différer une vérification de valeur, par exemple une requête de disponibilité d'email. Utilisez `lookup` avec un debounce pour différer un behavior qui charge et écrit une valeur. Un behavior réagit aux événements du champ et modifie son propre champ ; un validator signale les constats utilisés pour calculer la validité.
:::
