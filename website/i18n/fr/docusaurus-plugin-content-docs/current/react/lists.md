---
id: lists
title: Listes répétables
sidebar_position: 3
description: Afficher les lignes avec des clés stables et relier chaque input au formulaire de sa ligne.
---

# Listes répétables

Cette page montre comment afficher une liste modifiable de lignes de facture dans React. Vous ajouterez et retirerez des lignes, relierez leurs champs et retrouverez l'état de validation combiné de la liste.

`FieldArray<Row>` déclare une liste dont les lignes possèdent les champs décrits par `Row`. Chaque ligne a son `FormController`, l'objet qui gère les champs et exécute leurs behaviors et validators configurés. Un behavior réagit aux événements de champ ; un validator vérifie les valeurs et signale des messages.

Commencez par déclarer la liste dans la map du formulaire, le type qui associe les noms aux types de valeurs :

```ts
// src/form/invoice-form.ts
import { FormController, type FieldArray } from "slz-form";
import { hooksFor } from "slz-react-form";

export type InvoiceLine = { label: string; qty: number };
type InvoiceFields = { lines: FieldArray<InvoiceLine> };

export const invoiceForm = new FormController<InvoiceFields>({ name: "invoice" });
export const { useFieldArray, useForm } = hooksFor(invoiceForm);
```

`useFieldArray("lines")` renvoie les lignes dans leur ordre d'affichage et les opérations de modification de la liste :

```tsx
function InvoiceLines() {
    const { rows, append, remove } = useFieldArray("lines");

    return (
        <>
            {rows.map((row) => (
                <fieldset key={row.id}>
                    <LineLabel row={row} />
                    <button onClick={() => remove(row.id)}>Retirer</button>
                </fieldset>
            ))}
            <button onClick={append}>Ajouter une ligne</button>
        </>
    );
}
```

Reliez un champ de ligne avec `useFieldOn`, en lui passant le formulaire de la ligne. `FieldArrayRow` et `useFieldOn` sont exportés respectivement par `slz-form` et `slz-react-form` :

```tsx
function LineLabel({ row }: { row: FieldArrayRow<InvoiceLine> }) {
    const field = useFieldOn<string, never>(row.form, { name: "label", required: true });

    return (
        <input
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
        />
    );
}
```

`useFieldOn` accepte un formulaire sans utiliser sa map pour contraindre les paramètres. Fournissez explicitement le type de valeur et vérifiez que le nom correspond à un champ de ligne : ici, `<string, never>`. Le second paramètre de type décrit les métadonnées associées aux options ; `never` indique que ce champ n'en possède pas.

`row.id` reste identique quand vous retirez une autre ligne ou réordonnez la liste. Utilisez-le comme clé React pour que le composant reste associé au même formulaire de ligne.

Le hook fournit aussi `move(from, to)` et `clear()`. Le déplacement utilise des positions pour changer l'ordre d'affichage ; le retrait utilise l'identifiant stable.

## Lire l'état combiné

Un snapshot est un objet qui décrit l'état actuel du formulaire. Lisez la validation, les erreurs bloquantes et le chargement de la liste dans son entrée de `useForm().snapshot.arrays`. Son `ui` propose des flags, des états nommés comme `error` et `loading`, que vous lisez avec `hasFlag` ou `hasAny`.

`useFieldArray` s'abonne uniquement aux ajouts, retraits et déplacements. Modifier une valeur dans une ligne existante ne notifie pas cet abonnement à la liste. Chaque champ possède son abonnement, tandis que `useForm` s'abonne à l'état combiné du formulaire. Un récapitulatif peut ainsi réagir aux erreurs des lignes sans demander au composant de liste de s'abonner à chaque frappe.

Les rendus des parents React et les dépendances déclarées peuvent tout de même mettre à jour d'autres composants. Voir [Les hooks](./hooks.md) pour les abonnements, [Une ligne est un formulaire](../model/a-row-is-a-form.md) pour le modèle des lignes, et [Champs répétables](../guides/repeatable-fields.md) pour l'API du cœur.
