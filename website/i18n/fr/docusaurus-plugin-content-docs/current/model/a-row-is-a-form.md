---
id: a-row-is-a-form
title: Une ligne est un formulaire
sidebar_position: 4
description: Utiliser des identifiants stables et réutiliser la validation pour les champs répétables.
---

# Une ligne est un formulaire

Cette page explique comment les lignes répétables sont représentées et où écrire les règles qui concernent toute une liste. Vous verrez comment les identifiants permettent aux champs de conserver leurs noms quand les lignes changent de place.

Chaque ligne possède un `FormController`, l'objet qui gère ses champs, leur validation et leurs behaviors. Un behavior réagit aux événements de champ ; un validator vérifie les valeurs et signale des erreurs ou des avertissements. Les lignes utilisent ces API comme tout autre formulaire.

La liste se déclare avec `FieldArray<Row>`, qui associe un champ de liste aux types de champs de ses lignes. Vous accédez à une ligne par son identifiant, puis à ses champs par leur nom :

```ts
type InvoiceFields = { customer: string; lines: FieldArray<{ label: string; qty: number }> };

const lines = form.array("lines");
const id = lines.append();

const row = lines.row(id);          // `null` si la ligne a été retirée
const qty = row!.field("qty");
qty.mount();
qty.change(3);

lines.remove(id);
```

## Des identifiants stables

Chaque ligne possède un identifiant qui reste le même quand vous retirez ou réordonnez les autres lignes. Les noms de champs comme `qty` sont locaux au formulaire de cette ligne. Vous n'avez pas besoin de chemins comme `lines[0].qty` ou `lines.0.qty`.

Supprimer la première ligne de facture ne renomme par exemple pas le champ de quantité de la suivante. Une dépendance déclarée dans cette ligne désigne toujours le même champ. `watch` est la liste des champs dont les changements déclenchent un behavior ou un validator ; le formulaire de la ligne gère ses propres dépendances.

## Le cycle de vie d'une ligne

Les champs des lignes doivent être créés et montés, comme les champs d'un autre formulaire. Retirer une ligne démonte son formulaire et ses champs. Les hooks React gèrent le montage et le démontage des champs ; si vous utilisez directement le cœur, gérez ce cycle de vie dans votre application.

Le moteur utilise les mêmes types de champs et le même graphe des dépendances pour les formulaires parents et ceux des lignes. Voir [Champs répétables](../guides/repeatable-fields.md) pour les opérations sur les listes.

## Une règle pour toute la liste

Une règle comme « les parts doivent totaliser 100 » s'écrit sur un champ du formulaire parent. Elle observe la liste et lit les valeurs de toutes ses lignes :

```ts
class SharesMakeAHundred extends IValidator<string> {
    readonly watch = ["parts"];
    readonly validateWhenEmpty = true;
    protected validate(_value, report, ctx) {
        const parts = ctx.form.values().parts;
        const sum = Array.isArray(parts)
            ? parts.reduce((total, part) => total + Number(part.share), 0)
            : 0;
        report.errorIf(sum !== 100, `la somme fait ${sum}, pas 100`, { code: "sum" });
    }
}
```

Le champ qui porte ce validator peut être vide parce que sa propre valeur ne sert pas au calcul. `validateWhenEmpty` demande au validator d'exécuter sa règle personnalisée même sur une valeur vide. Déclarez cette option pour ce type de règle ; sinon la vérification personnalisée est ignorée sur cette valeur.

`ctx.form.values()` lit les valeurs actuelles. Cette lecture ne crée pas d'abonnement ; `watch = ["parts"]` relance la règle quand les valeurs de la liste changent. L'exemple se concentre sur le calcul ; ajoutez les types des paramètres et vérifiez les valeurs de lignes inconnues comme indiqué dans [Champs répétables](../guides/repeatable-fields.md).

La validité de la liste dépend des erreurs bloquantes de ses lignes. Elle publie les flags `valid` ou `error`, y compris avant une interaction utilisateur sur une ligne. Un flag est un état nommé lu avec `hasFlag` ou `hasAny`. La liste n'a pas d'état de validité `pristine`.
