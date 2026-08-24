import type { AnyUiFlag, UiState } from "../state";
import { errorsOf, sameIssues, type ValidationIssue } from "../validator/IValidator";
import type { OptionValue } from "./Field";
import type { FieldOption } from "./FieldOption";

export interface FieldSnapshotParams<T, M = never> {
    readonly name: string;
    readonly value: T | undefined;
    readonly ui: UiState;
    readonly issues: readonly ValidationIssue[];
    readonly options: readonly FieldOption<OptionValue<T>, M>[];
}

/**
 * The immutable value the consumer renders from — nothing more (invariant 21).
 *
 * Deux choses, et deux seulement : des **flags**, lus par `hasFlag` / `hasAny`,
 * qui disent dans quel état est le champ ; et des **données** — valeur, options,
 * messages — qui disent ce qu'il contient. Aucun booléen d'état (invariant 32) :
 * un besoin de `isX` signale un flag manquant.
 *
 * Two snapshots that describe the same state are `equals`, which is how the
 * controller keeps the **same object reference** when nothing changed. That
 * reference stability is what `useSyncExternalStore` requires, and what keeps a
 * change on one field from re-rendering the others (invariant 22).
 */
export class FieldSnapshot<T = string, M = never> {
    readonly name: string;
    readonly value: T | undefined;
    readonly ui: UiState;
    readonly issues: readonly ValidationIssue[];
    readonly options: readonly FieldOption<OptionValue<T>, M>[];

    constructor(params: FieldSnapshotParams<T, M>) {
        this.name = params.name;
        this.value = params.value;
        this.ui = params.ui;
        this.issues = params.issues;
        this.options = params.options;
    }

    /** ET — le champ porte **tous** ces flags. */
    hasFlag(...flags: AnyUiFlag[]): boolean {
        return this.ui.hasFlag(...flags);
    }

    /** OU — le champ porte **au moins un** de ces flags. */
    hasAny(...flags: AnyUiFlag[]): boolean {
        return this.ui.hasAny(...flags);
    }

    /** Projection à plat — débogage, rendu de l'état brut. */
    get flags(): readonly AnyUiFlag[] {
        return this.ui.flags;
    }

    get error(): string | undefined {
        return this.errors[0];
    }

    /** Les seuls constats bloquants. Dérivé : `issues` est le stockage. */
    get errors(): readonly string[] {
        return errorsOf(this.issues);
    }

    /** Les constats qui ne bloquent pas — la vue en fait ce qu'elle veut. */
    get warnings(): readonly string[] {
        return this.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message);
    }

    equals(other: FieldSnapshot<T, M>): boolean {
        return this.name === other.name
            && Object.is(this.value, other.value)
            && this.ui.equals(other.ui)
            && sameIssues(this.issues, other.issues)
            && sameOptions(this.options, other.options);
    }
}

type ComparableOption = {
    readonly value: unknown;
    readonly label: string;
    readonly disabled?: boolean;
    readonly meta?: unknown;
};

/**
 * Compare aussi `disabled` et `meta` : une liste dont seule la donnée métier
 * change est une liste différente, et ne pas la republier laisserait la vue sur
 * l'ancienne.
 */
function sameOptions(a: readonly ComparableOption[], b: readonly ComparableOption[]): boolean {
    if (a === b) {
        return true;
    }
    return a.length === b.length && a.every((option, i) => {
        const other = b[i];
        return other !== undefined
            && option.value === other.value
            && option.label === other.label
            && option.disabled === other.disabled
            && Object.is(option.meta, other.meta);
    });
}
