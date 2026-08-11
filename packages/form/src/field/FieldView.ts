import type { UiState, ValidityFlag } from "../state";
import type { OptionValue } from "./Field";
import type { FieldOption } from "./FieldOption";

/**
 * Projection en lecture seule d'un champ, remise à qui l'observe de l'extérieur :
 * un Behavior lisant une dépendance déclarée, ou la surface de lecture du Form.
 *
 * Elle expose exactement les trois choses que réclame l'invariant 7 — état UI,
 * valeur, état de validation — et rien qui puisse muter le champ (invariants 6, 8, 20).
 */
export interface FieldView<T = unknown, M = never> {
    readonly name: string;
    readonly value: T | undefined;
    readonly ui: UiState;
    readonly validity: ValidityFlag;
    readonly errors: readonly string[];
    readonly options: readonly FieldOption<OptionValue<T>, M>[];
    readonly mounted: boolean;
}

/**
 * Vue d'un champ dont on ne connaît ni le type de valeur ni celui du meta :
 * ce que voit la surface de lecture du formulaire, qui traverse tous les champs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFieldView = FieldView<unknown, any>;
