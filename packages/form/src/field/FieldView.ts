import type { AnyUiFlag, UiState } from "../state";
import type { ValidationIssue } from "../validator/IValidator";
import type { OptionValue } from "./Field";
import type { FieldOption } from "./FieldOption";

/**
 * Projection en lecture seule d'un champ, remise à qui l'observe de l'extérieur :
 * un Behavior lisant une dépendance déclarée, ou la surface de lecture du Form.
 *
 * Elle expose exactement les trois choses que réclame l'invariant 7 — état UI,
 * valeur, état de validation — et rien qui puisse muter le champ (invariants 6, 8, 20).
 *
 * Comme partout ailleurs : des flags pour l'état, des données pour le contenu.
 * Le **verdict** — « ce champ bloque-t-il, même sans qu'on y ait touché ? » — se
 * lit `errors.length > 0` ; le flag `error`, lui, dit ce qu'on **affiche**, et
 * reste éteint tant que le champ n'a pas été touché.
 */
export interface FieldView<T = unknown, M = never> {
    readonly name: string;
    readonly value: T | undefined;
    readonly ui: UiState;
    readonly errors: readonly string[];
    readonly issues: readonly ValidationIssue[];
    readonly options: readonly FieldOption<OptionValue<T>, M>[];
    /** ET — le champ porte **tous** ces flags. */
    hasFlag(...flags: AnyUiFlag[]): boolean;
    /** OU — le champ porte **au moins un** de ces flags. */
    hasAny(...flags: AnyUiFlag[]): boolean;
}

/**
 * Vue d'un champ dont on ne connaît ni le type de valeur ni celui du meta :
 * ce que voit la surface de lecture du formulaire, qui traverse tous les champs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFieldView = FieldView<unknown, any>;
