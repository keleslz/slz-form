---
id: champs-repetables
title: Champs répétables
sidebar_position: 4
description: Ajouter, retirer et valider des lignes — chacune étant un formulaire.
---

# Champs répétables

Une liste se déclare avec `FieldArray<Row>` dans la map, et se pilote par
`form.array(name)`. Les lignes sont **identifiées, jamais indexées** : ajouter,
déplacer ou retirer ne renomme rien.

```ts
type InvoiceFields = {
    customer: string;
    lines: FieldArray<{ label: string; qty: number }>;
};

const form = new FormController<InvoiceFields>({ name: "invoice" });
const lines = form.array("lines");

const id = lines.append();          // un identifiant stable, jamais un index
lines.row(id)?.field("qty").change(3);

lines.move(0, 1);
lines.remove(id);
lines.values();
```

`append()` rend l'identifiant de la nouvelle ligne ; `row(id)` rend la ligne, ou
`null` si elle a été retirée entre-temps. Une ligne **est** un formulaire — même
API, même validation, mêmes behaviors : `.field("qty")` la pilote exactement
comme un champ du parent. Le pourquoi est dans
[Une ligne est un formulaire](../modele/une-ligne-est-un-formulaire.md).

## Une règle qui porte sur l'ensemble

« La somme fait 100 % » ne vit dans aucune ligne : c'est un validator du parent
qui observe la liste. Il se pose sur un champ récapitulatif et déclare
`validateWhenEmpty`, sinon il ne tournerait jamais tant que ce champ est vide.

```ts
type Allocation = {
    parts: FieldArray<{ share: number }>;
    total: number;
};

class SharesMustSumTo100 extends IValidator<number> {
    readonly watch = ["parts"];
    readonly validateWhenEmpty = true;

    protected validate(_total: number | undefined, report: ValidationReport, ctx: ValidationContext): void {
        const rows = ctx.form.values().parts;
        const sum = (Array.isArray(rows) ? rows : []).reduce<number>((acc, row) => acc + shareOf(row), 0);
        report.errorIf(sum !== 100, `la somme fait ${sum}, pas 100`, { code: "sum" });
    }
}

const allocation = new FormController<Allocation>({ name: "allocation" });
allocation.field("total", { validator: new SharesMustSumTo100() });
```

`ctx.form.values()` est une vue de lecture typée `Record<string, unknown>` — le
formulaire n'y ouvre aucun abonnement — donc les lignes reviennent brutes et on
les rétrécit à la main, sans un seul `as` :

```ts
function shareOf(row: unknown): number {
    return typeof row === "object" && row !== null && "share" in row && typeof row.share === "number"
        ? row.share
        : 0;
}
```

## L'état d'une liste

Une liste répond aux mêmes deux fonctions que le reste, et publie `valid` ·
`error` — jamais `pristine` : c'est un agrégat, pas un champ qu'on touche.

```ts
lines.ui.hasFlag("error");     // au moins une ligne refuse
lines.errors;                  // les constats, à plat
lines.ui.hasFlag("loading");   // une ligne a du travail en vol
```

Côté React, le même état agrégé se lit par `useForm().snapshot.arrays` — et non
par `useFieldArray`, qui ne s'abonne qu'à la **composition** de la liste (ajout,
retrait, déplacement). Le détail des hooks est dans [Listes](../react/listes.md).
