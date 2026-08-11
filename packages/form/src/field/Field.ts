/**
 * Déclaration d'un champ dans la map d'un formulaire.
 *
 * Une valeur nue suffit dans le cas courant :
 *
 * ```ts
 * new FormController<{ brand: string; mileage: number }>({ name: "car" })
 * ```
 *
 * `Field<V, M>` sert quand les options du champ portent des données métier :
 *
 * ```ts
 * new FormController<{ brand: Field<string, { logo: string }> }>({ name: "car" })
 * // field.options[0].meta.logo  →  string
 * ```
 */
export interface Field<V, M = never> {
    readonly value: V;
    readonly meta: M;
}

/** Forme d'une map de champs : un nom, une déclaration. */
export type FieldsShape = Record<string, unknown>;

/** Type de valeur porté par une déclaration de champ. */
export type ValueOf<F> = F extends Field<infer V, unknown> ? V : F;

/** Type de meta porté par les options d'une déclaration de champ. */
export type MetaOf<F> = F extends Field<unknown, infer M> ? M : never;

/**
 * Type de valeur d'**une option**, à partir du type de valeur du champ.
 *
 * Pour un multi-select la valeur du champ est `string[]` alors qu'une option
 * vaut `string` : le type d'option est l'élément, pas la collection.
 */
export type OptionValue<V> = V extends readonly (infer U)[] ? U : V;

/** Idem, à partir d'une déclaration de champ. */
export type OptionValueOf<F> = OptionValue<ValueOf<F>>;

/** Les valeurs des champs observés, telles que les reçoit un behavior. */
export type WatchedValues<TFields extends FieldsShape, W extends keyof TFields> = {
    readonly [K in W]: ValueOf<TFields[K]> | undefined;
};
