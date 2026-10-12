---
id: repeatable-fields
title: Champs répétables
sidebar_position: 4
description: Ajouter, déplacer et retirer des lignes, puis valider les valeurs de toute une liste.
---

# Champs répétables

Cette page montre comment ajouter, déplacer et retirer des lignes de facture avec le cœur. Vous écrirez aussi une règle qui vérifie toutes les lignes ensemble et lirez la validation et le chargement de la liste.

`FieldArray<Row>` déclare une liste dans la map, le type qui associe les noms de champs à leurs valeurs. `Row` déclare les champs de chaque ligne. `form.array(name)` renvoie le contrôleur qui gère cette liste.

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

`append()` renvoie un identifiant stable de ligne. `row(id)` renvoie un `FieldArrayRow`, ou `null` si la ligne n'est plus présente. Cet objet contient son `id` stable et son `FormController` dans `form`. Un `FormController` gère les champs et leurs règles. Le `.field("qty")` de la ligne délègue à ce formulaire pour créer ou retrouver son champ de quantité.

`move(from, to)` utilise des positions pour réordonner les lignes ; les identifiants restent inchangés. `remove(id)` retire une ligne par son identifiant, et `values()` lit les valeurs des lignes dans leur ordre actuel. Le déplacement de l'exemple ne change l'ordre que si les deux positions existent.

Créez et montez les champs des lignes pour les inclure dans la validation et les valeurs. Les hooks de champs React gèrent ce montage. Voir [Une ligne est un formulaire](../model/a-row-is-a-form.md) pour le cycle de vie et le modèle des dépendances.

## Une règle pour toute la liste

Un validator vérifie une valeur et signale des constats, des messages de gravité `error` ou `warning`. Pour vérifier que les parts d'une répartition totalisent 100, associez un validator à un champ récapitulatif du parent et faites-lui observer la liste. `watch` liste les dépendances dont les changements de valeur relancent la règle.

`validateWhenEmpty` active la règle même quand le champ récapitulatif est vide. Sa propre valeur ne sert pas à ce calcul :

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

`ctx.form.values()` renvoie un `Record<string, unknown>` en lecture seule. Il lit les valeurs actuelles sans s'abonner aux changements ; le `watch` déclaré déclenche la revalidation. Vérifiez le type de chaque ligne avant d'utiliser ses propriétés, par exemple avec cette fonction :

```ts
function shareOf(row: unknown): number {
    return typeof row === "object" && row !== null && "share" in row && typeof row.share === "number"
        ? row.share
        : 0;
}
```

## L'état d'une liste

Un flag est un état nommé vérifié avec `hasFlag` ou `hasAny`. Le `ui` d'une liste rassemble l'état de ses lignes : `valid` si elles n'ont aucune erreur bloquante, `error` sinon, et `loading` lorsqu'une ligne a une opération en attente. Il n'a pas d'état de validité `pristine`, même si personne n'a interagi avec les lignes.

```ts
lines.ui.hasFlag("error");     // au moins une ligne refuse
lines.errors;                  // les constats, à plat
lines.ui.hasFlag("loading");   // une ligne a du travail en vol
```

`lines.errors` contient les messages bloquants de toutes les lignes dans un seul tableau. Il peut inclure des erreurs de champs sans interaction, alors que leur validité affichée reste `pristine` jusqu'à une interaction.

Dans React, lisez cet état combiné via `useForm().snapshot.arrays`. Un snapshot est l'objet qui décrit l'état actuel du formulaire. `useFieldArray` s'abonne aux ajouts, retraits et déplacements de lignes ; il ne s'abonne ni à leur contenu ni à leurs flags. Voir [Listes répétables](../react/lists.md).
