---
id: validate
title: Valider
sidebar_position: 2
description: Écrire une règle, signaler des constats bloquants et des avertissements avec un code, lire d'autres champs, combiner des validators, afficher les erreurs du serveur.
---

# Valider

Un validator **juge** une valeur : c'est la seule source de validité de son
champ. Vous étendez `IValidator<T>`, où `T` est le type de la valeur, et vous
signalez les constats par `report`.

## Une règle {#a-rule}

```ts
import { IValidator, type ValidationReport } from "slz-form";

class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport) {
        report.errorIf(!value.includes("@"), "Invalid email address");
    }
}

form.field("email", { required: true, validator: new EmailValidator() });
```

La règle s'exécute à chaque changement de valeur — par `change()`, par une
valeur écrite par un behavior, au montage du champ — et à nouveau quand on
quitte le champ et à la soumission.

Une règle peut être `async` : renvoyez une promesse, et le champ porte `loading`
jusqu'à ce qu'elle aboutisse. Passez `ctx.signal` (le troisième argument) à
`fetch`, pour qu'une requête soit annulée au démontage du champ.

:::caution Une instance de validator pour un seul champ
Une instance de validator porte le verdict de son champ. Passer la même instance
à deux champs lève une erreur à la création du second. Créez-en une par champ.
:::

## Valeurs vides et `required`

Les règles **ne s'exécutent pas sur une valeur vide** — `undefined`, `null`, une
chaîne blanche, un tableau vide. Qu'un champ vide soit acceptable ou non, c'est
ce que dit `required` :

| Option du champ | Effet |
|---|---|
| `required: true` | une valeur vide reçoit un constat bloquant, `code: "required"`, message `"This field is required"` |
| `requiredMessage: "…"` | remplace ce message |
| `requiredTrue: true` | traite aussi `false` comme vide — pour une case à cocher qui doit être cochée |

Une règle qui décide **elle-même** si le champ est obligatoire (« obligatoire si
le compte est professionnel ») doit s'exécuter sur les valeurs vides : déclarez
`readonly validateWhenEmpty = true`, et la valeur reçue peut alors être
`undefined`.

## Constats : gravité et code {#issues-severity-and-code}

```ts
report.error("Expected format: CUST-42-9013", { code: "format" });
report.warn("This postcode looks unusual", { code: "unusual" });
report.errorIf(condition, "message", { code: "…" });
report.warnIf(condition, "message", { code: "…" });
```

- Une **erreur** bloque la soumission. Un **avertissement**, non.
- Le `code` est pour **vous** : afficher le message sous le champ, dans un toast
  ou nulle part, le traduire… Le moteur transporte `severity` et `code`, et ne
  décide jamais de l'affichage.

Sur le champ, lisez-les comme des données :

| Lecture | Donne |
|---|---|
| `snapshot.errors` | les messages bloquants uniquement |
| `snapshot.error` | le premier message bloquant, ou `undefined` |
| `snapshot.warnings` | les messages non bloquants |
| `snapshot.issues` | tous les constats, avec `message`, `severity` et `code` |

`form.snapshot.errors` donne les messages bloquants de tous les champs montés et
visibles, indexés par nom de champ — et, pour chaque liste qui a un constat
bloquant, les messages de ses lignes sous le nom de la liste.

Le moteur écrit lui-même deux messages : `"This field is required"`
(`code: "required"`, remplaçable par `requiredMessage`) et
`"Validation unavailable"` (`code: "unverified"`, voir
[Une passe interrompue](../model/interrupted-pass.md)). Pour les traduire,
routez sur `code`.

## Lire un autre champ

Déclarez dans `watch` les champs que lit la règle ; elle est relancée quand
**leur valeur** change.

```ts
import { IValidator, type ValidationContext, type ValidationReport } from "slz-form";

class SameAsPassword extends IValidator<string> {
    readonly watch = ["password"];
    protected validate(value: string, report: ValidationReport, ctx: ValidationContext) {
        report.errorIf(value !== ctx.watched("password")?.value, "Does not match");
    }
}
```

`ctx.watched(name)` **lève une erreur** pour un nom absent de `watch`. Le moteur
attrape cette erreur, donc rien ne plante : selon la règle, le champ reçoit un
constat `"unverified"` ou garde un verdict périmé, et l'erreur est enregistrée
dans `form.engineErrors` — facile à manquer si vous ne le lisez jamais. Voir
[Lire un champ observé](dependencies.md#reading-a-watched-field).

:::caution Utilisez `ctx.watched()`, pas `ctx.form.field()`
`ctx.form.field(name)` et `ctx.form.values()` lisent aussi d'autres champs, mais
rien ne les vérifie contre `watch` et rien ne relance la règle quand ils
changent : le verdict devient périmé sans bruit. Lisez ce dont vous dépendez
avec `ctx.watched()`.
:::

Une règle croisée affiche son erreur sur le champ qui la porte, et seulement
une fois ce champ touché. Si `confirm` contient déjà une valeur mais n'a pas été
touché quand un changement de `password` le rend faux, le verdict du formulaire
passe à `error` alors que `confirm` n'affiche rien — jusqu'à ce que
l'utilisateur y arrive, ou soumette. Posez la règle sur le champ rempli en
dernier, ou affichez `form.snapshot.errors`.

## Plusieurs validators sur un champ {#several-validators-on-one-field}

Passez un tableau. Chaque validator garde ses propres règles, et leurs constats
s'additionnent :

```ts
const serverIssues = new ExternalValidator<string>();

form.field("email", { validator: [new EmailValidator(), serverIssues] });

// after the server answered 422
serverIssues.set([{ message: "Already taken", severity: "error", code: "taken" }]);
```

`ExternalValidator` porte des constats venus de l'extérieur — typiquement une
réponse du serveur. `set()` les applique tout de suite, même si la valeur n'a
pas changé ; ils sont **effacés dès que la valeur change**, parce qu'une erreur
serveur porte sur ce qui a été envoyé, pas sur ce que l'utilisateur est en train
de corriger. `clear()` les retire à la main.

Seul `severity: "error"` bloque. Si votre serveur emploie d'autres mots,
traduisez-les en `"error"` ou `"warning"` avant d'appeler `set()`.

## Attendre avant de valider

```ts
new DebouncedValidator(new UsernameValidator(), 400);
```

`DebouncedValidator` attend que l'utilisateur ait cessé de taper depuis 400 ms
avant d'exécuter la règle qu'il enveloppe. Le champ est `loading` dès la
première frappe. Quitter le champ ou soumettre exécute tout de suite la règle en
attente : un formulaire soumis dans les 400 ms n'est jamais jugé sur un verdict
périmé. `required` n'est pas différé.

:::tip Deux sortes de délai
`DebouncedValidator` diffère un validator, qui **juge** une valeur. L'option
`debounce` de `lookup` et `loadOptions` diffère un behavior, qui **écrit** une
valeur ou des options. L'un ne remplace pas l'autre.
:::

## Quand une règle casse

Si une règle `async` échoue, ou si une règle d'un tableau d'au moins deux
validators lève une erreur, le champ reçoit un constat bloquant `"unverified"`
(ou le refus d'une autre règle) — ni `valid`, ni le verdict précédent. Une
règle synchrone seule qui lève une erreur **garde aujourd'hui son verdict
précédent**, et la valeur peut être soumise : c'est un écart connu, avec son
contournement, décrit dans
[Une passe interrompue n'est pas un verdict](../model/interrupted-pass.md).
