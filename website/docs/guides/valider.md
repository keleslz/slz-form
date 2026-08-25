---
id: valider
title: Valider
sidebar_position: 2
description: Constats, gravité, codes, validators composés et erreurs serveur.
---

# Valider

## Une règle

```ts
class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport) {
        report.errorIf(!value.includes("@"), "Adresse email invalide");
    }
}
```

:::note Les règles ne tournent pas sur une valeur vide
Sauf si le validator déclare `validateWhenEmpty = true`. Une règle qui décide
elle-même de l'obligation doit donc le dire, sinon elle ne sera jamais appelée
sur le cas qui l'intéresse.
:::

## Un constat porte une gravité et un code

```ts
report.error("Format attendu : CUST-42-9013", { code: "format" });
report.warn("Ce code postal semble inhabituel", { code: "unusual" });
```

Un avertissement **ne bloque pas** la soumission. Le `code` est là pour que
**vous** décidiez : snackbar, sous le champ, ou rien. Le moteur transporte
`severity` et `code` ; il n'affiche jamais, et ne connaît ni couleur ni libellé.

## Lire un autre champ

Le validator déclare ce qu'il observe, et se voit rejouer quand cela change.

```ts
class SameAsPassword extends IValidator<string> {
    readonly watch = ["password"];
    protected validate(value: string, report: ValidationReport, ctx: ValidationContext) {
        report.errorIf(value !== ctx.watched("password")?.value, "Ne correspond pas");
    }
}
```

`ctx.watched` **lève** sur un nom non déclaré : une dépendance réactive reste
explicite, et ne peut pas s'installer par accident.

## Plusieurs validators sur un champ

```ts
const serverIssues = new ExternalValidator<string>();

form.field("email", { validator: [new EmailValidator(), serverIssues] });

// après un 422
serverIssues.set([{ message: "Déjà pris", severity: "error", code: "taken" }]);
```

Un tableau devient un composite, invisible pour l'appelant : chaque membre garde
ses règles, les constats sont agrégés.

Les constats injectés **s'effacent dès que la valeur change** : une erreur
serveur porte sur ce qui a été envoyé, pas sur ce que l'utilisateur est en train
de corriger.

## Quand une règle casse

Voir [Une passe interrompue n'est pas un verdict](../modele/passe-interrompue.md) —
c'est le point le plus subtil de la validation, et celui qui a le plus régressé.

## Différer une validation

```ts
new DebouncedValidator(new EmailValidator(), 400);
```

`IValidator.flush()` permet au champ de trancher sans attendre au blur et à la
soumission — sinon un formulaire soumis dans les 400 ms partirait sur un verdict
qui n'a pas encore été rendu.

:::tip Deux mécanismes de debounce, et ils ne sont pas interchangeables
`DebouncedValidator` diffère un validator, qui **juge** une valeur. `lookup`
diffère un behavior, qui en **écrit** une. Ils tombent sur deux axes différents,
et aucun ne peut faire le travail de l'autre.
:::
