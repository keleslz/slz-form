---
id: champs-repetables
title: Champs répétables
sidebar_position: 4
description: Ajouter, retirer et valider des lignes — chacune étant un formulaire.
---

# Champs répétables

```ts
type InvoiceFields = { customer: string; lines: FieldArray<{ label: string; qty: number }> };

const lines = form.array("lines");
const id = lines.append();

// `row` rend `null` si la ligne a été retirée entre-temps.
const row = lines.row(id);
if (row) {
    const qty = row.field("qty");
    qty.mount();             // comme pour un champ de formulaire
    qty.change(3);
}

lines.remove(id);
```

Une ligne **est** un formulaire : même API, même validation, mêmes behaviors.
Les lignes sont identifiées et jamais indexées, donc réordonner ne renomme rien.
Le pourquoi est dans
[Une ligne est un formulaire](../modele/une-ligne-est-un-formulaire.md).

## Une règle qui porte sur l'ensemble

Elle se déclare sur le parent :

```ts
class SharesMakeAHundred extends IValidator<string> {
    readonly watch = ["parts"];
    readonly validateWhenEmpty = true;
    protected validate(_value, report, ctx) {
        const sum = (ctx.form.values().parts as { share: number }[])
            .reduce((total, part) => total + part.share, 0);
        report.errorIf(sum !== 100, `la somme fait ${sum}, pas 100`, { code: "sum" });
    }
}
```

## L'état d'une liste

Une liste répond aux mêmes deux fonctions que le reste, et publie `valid` ·
`error` — jamais `pristine` : c'est un agrégat, pas un champ qu'on touche.

```ts
lines.ui.hasFlag("error");   // au moins une ligne refuse
lines.errors;                // les constats, à plat
lines.isBusy;                // une ligne a du travail en vol
```

Côté React, le même état agrégé se lit par `useForm().snapshot.arrays` — et
non par `useFieldArray`, qui ne s'abonne qu'à la composition de la liste.
