---
id: une-ligne-est-un-formulaire
title: Une ligne est un formulaire
sidebar_position: 4
description: Pourquoi les champs répétables n'ont pas de nommage par chemins.
---

# Une ligne est un formulaire

Les champs répétables n'ont **pas** de nommage par chemins — ni `lines[0].qty`,
ni `lines.0.qty`. Une ligne **est** un `FormController` : même API, même
validation, mêmes behaviors.

```ts
type InvoiceFields = { customer: string; lines: FieldArray<{ label: string; qty: number }> };

const lines = form.array("lines");
const id = lines.append();

const qty = lines.row(id).field("qty");
qty.mount();                 // comme pour un champ de formulaire
qty.change(3);

lines.remove(id);
```

## Ce que ça évite

Les lignes sont **identifiées**, jamais indexées. Retirer ou déplacer une ligne
ne renomme donc rien, et aucun `watch` ne se met à pointer dans le vide.

Avec un nommage par index, supprimer la ligne 0 fait de l'ancienne ligne 1 la
nouvelle ligne 0 : toute dépendance déclarée sur `lines[1].qty` observe
silencieusement une autre ligne. Le bug est invisible en lecture et pénible à
reproduire.

## Le prix assumé

Une ligne se monte et se démonte comme un formulaire. En échange, rien n'a été
refondu pour les accueillir — ni `FieldsShape`, ni `FieldNameOf`, ni le graphe
de dépendances.

## Une règle qui porte sur l'ensemble

Elle se déclare sur le **parent**, pas sur la ligne :

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

`validateWhenEmpty` est nécessaire : les règles ne tournent pas sur une valeur
vide, et cette règle-ci ne juge pas la valeur du champ porteur mais la somme des
lignes.

La validité d'une liste suit la même logique que celle du formulaire : `valid` ·
`error`, jamais `pristine`. Une liste est un agrégat, pas un champ qu'on touche.
