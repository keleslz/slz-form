import type { FieldsShape } from "../field/Field";

/**
 * Déclaration d'une **liste de lignes** dans la map d'un formulaire.
 *
 * ```ts
 * type InvoiceLine = { label: string; qty: number };
 * type InvoiceFields = { customer: string; lines: FieldArray<InvoiceLine> };
 * ```
 *
 * Le parti pris : **une ligne est un formulaire**. Aucun nommage par chemins
 * (`lines.3.qty`) — il aurait imposé des types littéraux gabarits partout, et
 * surtout le réindexage après suppression aurait cassé tous les `watch` qui
 * pointent une ligne. Une ligne réutilise `FormController` tel quel : son
 * graphe de dépendances, sa validation et ses snapshots fonctionnent déjà.
 */
export interface FieldArray<TRow extends FieldsShape> {
    readonly row: TRow;
}

/** Les noms de la map qui déclarent une liste. */
export type ArrayNameOf<TFields extends FieldsShape> = Extract<{
    [K in keyof TFields]: TFields[K] extends FieldArray<FieldsShape> ? K : never;
}[keyof TFields], string>;

/** Les noms de la map qui déclarent un champ simple — tout sauf les listes. */
export type PlainNameOf<TFields extends FieldsShape> = Exclude<
    Extract<keyof TFields, string>,
    ArrayNameOf<TFields>
>;

/** La forme d'une ligne, à partir de la déclaration de la liste. */
export type RowOf<F> = F extends FieldArray<infer TRow> ? TRow : never;
