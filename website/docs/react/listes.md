---
id: listes
title: Listes répétables
sidebar_position: 3
description: useFieldArray, useFieldOn, et pourquoi la liste ne publie pas les flags de ses lignes.
---

# Listes répétables

Une liste se déclare `FieldArray<Row>` dans la map. `useFieldArray(name)` en rend
la composition ; chaque ligne est un formulaire à part entière.

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
                    <button onClick={() => remove(row.id)}>Retirer</button>
                </fieldset>
            ))}
            <button onClick={append}>Ajouter une ligne</button>
        </>
    );
}
```

Un champ de ligne se câble avec `useFieldOn`, en lui passant le formulaire de la
ligne :

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

`useFieldOn` prend un formulaire quelconque : la map de la ligne est effacée à ce
pont générique, donc le type de la valeur se donne à la main — `<string, never>`
ici (`never` : ce champ ne porte pas de meta d'options).

`row.id` est **stable** : il ne change ni à la suppression d'une autre ligne, ni
au réordonnancement. C'est une clé React fiable, et c'est ce qui évite qu'un
déplacement casse les dépendances déclarées.

## Où lire l'état agrégé

L'état agrégé d'une liste — sa validité, ses erreurs, son travail en vol — se lit
par `useForm().snapshot.arrays`, **pas** par `useFieldArray`.

`useFieldArray` ne s'abonne qu'à la **composition** de la liste (ajout, retrait,
déplacement), pour qu'une frappe dans une ligne ne re-rende pas les autres. Y
exposer des flags les rendrait périmés dès la frappe suivante — un état faux
affiché avec assurance, ce qui est pire que pas d'état du tout.

Le pourquoi — une ligne est un `FormController` identifié, jamais indexé — est
dans [Une ligne est un formulaire](../modele/une-ligne-est-un-formulaire.md) ; le
versant moteur, dans [Champs répétables](../guides/champs-repetables.md).
