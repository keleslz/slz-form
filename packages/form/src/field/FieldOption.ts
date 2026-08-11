/**
 * Les options sont une dimension de premier rang du champ, pas des données
 * libres : select, multi-select et radio en ont besoin, et « va chercher mes
 * options » est de loin le besoin asynchrone le plus courant.
 *
 * `M` transporte les données métier de l'option — l'enregistrement brut renvoyé
 * par l'API, dont on ne veut pas perdre l'avatar ou le sous-titre en cours de
 * route. Quand il n'est pas déclaré, `meta` n'existe pas ; quand il l'est, il
 * est **obligatoire**, donc lisible sans `?.`.
 */
export type FieldOption<V = string, M = never> = {
    readonly value: V;
    readonly label: string;
    readonly disabled?: boolean;
} & ([M] extends [never] ? { readonly meta?: undefined } : { readonly meta: M });
