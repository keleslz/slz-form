import type { UiFlag, UiState, ValidityFlag } from "../state";
import { errorsOf, sameIssues, type ValidationIssue } from "../validator/IValidator";
import type { OptionValue } from "./Field";
import type { FieldOption } from "./FieldOption";

export interface FieldSnapshotParams<T, M = never> {
    readonly name: string;
    readonly value: T | undefined;
    readonly ui: UiState;
    readonly issues: readonly ValidationIssue[];
    readonly options: readonly FieldOption<OptionValue<T>, M>[];
    readonly touched: boolean;
    readonly focused: boolean;
    readonly required: boolean;
    readonly submitting: boolean;
    readonly mounted: boolean;
}

/**
 * The immutable value the consumer renders from — nothing more (invariant 21).
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
    readonly touched: boolean;
    readonly focused: boolean;
    readonly required: boolean;
    readonly submitting: boolean;
    readonly mounted: boolean;

    constructor(params: FieldSnapshotParams<T, M>) {
        this.name = params.name;
        this.value = params.value;
        this.ui = params.ui;
        this.issues = params.issues;
        this.options = params.options;
        this.touched = params.touched;
        this.focused = params.focused;
        this.required = params.required;
        this.submitting = params.submitting;
        this.mounted = params.mounted;
    }

    has(...flags: UiFlag[]): boolean {
        return this.ui.has(...flags);
    }

    get validity(): ValidityFlag {
        return this.ui.validity;
    }

    get isPristine(): boolean {
        return this.ui.validity === "pristine";
    }

    get isValid(): boolean {
        return this.ui.validity === "valid";
    }

    get isLoading(): boolean {
        return this.ui.activity === "loading";
    }

    get isLocked(): boolean {
        return this.ui.has("locked");
    }

    get isVisible(): boolean {
        return !this.ui.has("invisible");
    }

    /** An error the consumer should surface: invalid *and* already interacted with. */
    get showError(): boolean {
        return this.ui.validity === "error" && this.touched;
    }

    get error(): string | undefined {
        return this.errors[0];
    }

    /** Les seuls constats bloquants. Dérivé : `issues` est le stockage. */
    get errors(): readonly string[] {
        return errorsOf(this.issues);
    }

    /**
     * Le **verdict**, indépendamment de l'affichage.
     *
     * `validity` dit ce qu'on montre : il reste `pristine` tant que le champ n'a
     * pas été touché, pour qu'un prefill n'allume pas d'erreur. `isBlocking` dit
     * ce qui est vrai — c'est lui qui décide si le formulaire est soumettable.
     */
    get isBlocking(): boolean {
        return this.issues.some((issue) => issue.severity === "error");
    }

    /** Les constats qui ne bloquent pas — la vue en fait ce qu'elle veut. */
    get warnings(): readonly string[] {
        return this.issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message);
    }

    /**
     * Lisible et sélectionnable, mais non modifiable — distinct de `isLocked`,
     * qui grise le champ.
     */
    get isReadOnly(): boolean {
        return this.ui.has("readonly");
    }

    equals(other: FieldSnapshot<T, M>): boolean {
        return this.name === other.name
            && Object.is(this.value, other.value)
            && this.ui.equals(other.ui)
            && this.touched === other.touched
            && this.focused === other.focused
            && this.required === other.required
            && this.submitting === other.submitting
            && this.mounted === other.mounted
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
