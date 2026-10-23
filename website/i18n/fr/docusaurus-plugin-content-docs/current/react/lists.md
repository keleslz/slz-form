---
id: lists
title: Listes répétables
sidebar_position: 3
description: Afficher une liste de lignes avec useFieldArray, brancher les champs de chaque ligne avec useFieldOn, et lire l'état de la liste dans useForm.
---

# Listes répétables

Une liste se déclare `FieldArray<Row>` dans la map de champs.
`useFieldArray(name)` vous donne ses lignes ; chaque ligne est un petit
formulaire à part entière, avec ses propres champs.

```ts
// src/form/invoice-form.ts
import { FormController, type FieldArray } from "slz-form";
import { hooksFor } from "slz-react-form";

export type InvoiceLine = { label: string; qty: number };
type InvoiceFields = { lines: FieldArray<InvoiceLine> };

export const invoiceForm = new FormController<InvoiceFields>({ name: "invoice" });
export const { useFieldArray, useForm } = hooksFor(invoiceForm);
```

```tsx
function InvoiceLines() {
    const { rows, append, remove } = useFieldArray("lines");

    return (
        <>
            {rows.map((row) => (
                <fieldset key={row.id}>
                    <LineLabel row={row} />
                    <button onClick={() => remove(row.id)}>Remove</button>
                </fieldset>
            ))}
            <button onClick={append}>Add a row</button>
        </>
    );
}
```

`useFieldArray("lines")` n'accepte que les noms déclarés en `FieldArray` dans la
map. Il rend `rows` (dans l'ordre d'affichage) et `append()`, `remove(id)`,
`move(from, to)`, `clear()`.

## Les champs d'une ligne

Le champ d'une ligne se branche avec `useFieldOn`, en lui donnant le formulaire
de la ligne :

```tsx
import type { FieldArrayRow } from "slz-form";
import { useFieldOn } from "slz-react-form";

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

`useFieldOn` accepte n'importe quel formulaire, il ne peut donc pas vérifier
`name` contre la map de la ligne : vous donnez vous-même le type de la valeur —
ici `<string, never>`, où `never` signifie que les options du champ ne portent
aucune donnée supplémentaire. Il rend exactement ce que rend `useField`.

`row.id` est **stable** : il ne change ni quand une autre ligne est retirée, ni
quand les lignes sont réordonnées. Utilisez-le comme `key` React : chaque
composant de ligne garde son propre état quand les lignes bougent.

Une ligne ne contribue au payload que par ses champs montés : une ligne dont les
composants n'affichent aucun champ apporte `{}` et ne bloque rien.

## Où lire l'état de la liste {#where-to-read-the-state-of-the-list}

L'état d'une liste — son verdict, ses erreurs, son travail en cours — se lit dans
`useForm().snapshot.arrays`, **pas** dans `useFieldArray` :

```tsx
function LinesStatus() {
    const { snapshot } = useForm();
    const linesSummary = snapshot.arrays.find((list) => list.name === "lines");
    return <p>{linesSummary?.ui.hasFlag("error") ? "A line is incomplete" : null}</p>;
}
```

`useFieldArray` ne se re-rend que lorsque des lignes sont ajoutées, retirées ou
déplacées, pour que taper dans une ligne ne re-rende pas les autres. S'il
exposait les flags de la liste, ils seraient périmés dès la frappe suivante.

Les raisons pour lesquelles une ligne est un formulaire sont dans
[Une ligne est un formulaire](../model/a-row-is-a-form.md) ; le côté moteur, dans
[Champs répétables](../guides/repeatable-fields.md).
