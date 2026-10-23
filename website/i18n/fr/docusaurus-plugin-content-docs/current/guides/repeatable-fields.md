---
id: repeatable-fields
title: Champs répétables
sidebar_position: 5
description: Ajouter, déplacer, retirer et valider les lignes d'une liste — chaque ligne étant un petit formulaire à part entière.
---

# Champs répétables

Une liste de lignes — lignes de facture, contacts — se déclare avec
`FieldArray<Row>` dans la map de champs, et se pilote par `form.array(name)`.
Les lignes sont **identifiées, jamais indexées** : ajouter, déplacer ou retirer
une ligne ne renomme rien.

```ts
import { FormController, type FieldArray } from "slz-form";

type InvoiceFields = {
    customer: string;
    lines: FieldArray<{ label: string; qty: number }>;
};

const form = new FormController<InvoiceFields>({ name: "invoice" });
const lines = form.array("lines");

const first = lines.append();       // a stable id, never an index
const second = lines.append();
const qty = lines.row(first)?.field("qty");
qty?.mount();
qty?.change(3);

lines.move(0, 1);                   // reorder by position; ids do not change
lines.remove(second);
lines.values();                     // [{ qty: 3 }] — the mounted fields of each row, in display order
```

| Méthode | Ce qu'elle fait |
|---|---|
| `append()` | ajoute une ligne vide et rend son identifiant |
| `row(id)` | la ligne, ou `null` si elle a été retirée |
| `remove(id)` | retire une ligne : ses valeurs quittent le payload |
| `move(from, to)` | déplace la ligne de la position `from` à la position `to` |
| `clear()` | retire toutes les lignes |
| `rows` | les lignes, dans l'ordre d'affichage — chacune a un `id` et un `form` |
| `values()` | les valeurs des lignes, dans l'ordre d'affichage |

Une ligne **est** un formulaire : `row.field("qty")` crée et rend un champ
exactement comme `form.field(...)`, et ce champ doit être monté pour compter.
Une ligne neuve n'a aucun champ tant que vous ne les créez pas : elle apporte
donc `{}` au payload et ne bloque rien. En React, `useFieldOn(row.form, …)` crée
et monte le champ pour vous — voir [Listes répétables](../react/lists.md). Les
raisons de ce choix sont dans
[Une ligne est un formulaire](../model/a-row-is-a-form.md).

`form.reset()` retire toutes les lignes : une liste commence vide.

## Une règle qui porte sur toute la liste {#a-rule-about-the-whole-list}

« Les parts font 100 au total » n'appartient à aucune ligne. Posez un validator
sur un champ du formulaire **parent** — ici un champ `total` — qui observe la
liste :

```ts
import { FormController, IValidator, type FieldArray, type ValidationContext, type ValidationReport } from "slz-form";

type Allocation = {
    parts: FieldArray<{ share: number }>;
    total: number;
};

class SharesMustSumTo100 extends IValidator<number> {
    readonly watch = ["parts"];
    readonly validateWhenEmpty = true;

    protected validate(_total: number | undefined, report: ValidationReport, ctx: ValidationContext): void {
        const rows = ctx.watched("parts")?.value;
        const sum = (Array.isArray(rows) ? rows : []).reduce<number>((acc, row) => acc + shareOf(row), 0);
        report.errorIf(sum !== 100, `the sum is ${sum}, not 100`, { code: "sum" });
    }
}

const allocation = new FormController<Allocation>({ name: "allocation" });
allocation.field("total", { validator: new SharesMustSumTo100() }).mount();
```

- `watch: ["parts"]` relance la règle dès que la valeur d'une ligne change, ou
  qu'une ligne est ajoutée, déplacée ou retirée.
- `validateWhenEmpty` est indispensable : la règle juge les lignes, pas la
  valeur de `total`, qui peut très bien être vide.

La valeur d'un champ observé est typée `unknown` : vous affinez les lignes
vous-même — sans `as` :

```ts
function shareOf(row: unknown): number {
    return typeof row === "object" && row !== null && "share" in row && typeof row.share === "number"
        ? row.share
        : 0;
}
```

Deux choses à savoir sur le champ porteur :

- c'est un vrai champ, il fait donc partie de `form.values()` (ici `total`) ;
- comme tout champ, il n'affiche son erreur qu'une fois touché. Tant que
  l'utilisateur ne l'a pas touché ou n'a pas soumis, lisez le message dans
  `allocation.snapshot.errors.total`.

## L'état d'une liste

Une liste répond aux deux mêmes fonctions qu'un champ, avec les mots d'un
formulaire : `valid` ou `error` — jamais `pristine`, puisque personne ne
« touche » une liste.

```ts
lines.ui.hasFlag("error");     // at least one row has a blocking issue
lines.errors;                  // the blocking messages of every row, flattened
lines.ui.hasFlag("loading");   // a row has work in flight
```

En React, lisez cet état dans `useForm().snapshot.arrays`, pas dans
`useFieldArray` — voir
[Listes répétables](../react/lists.md#where-to-read-the-state-of-the-list).
