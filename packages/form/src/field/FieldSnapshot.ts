import type { UiFlag, UiState, ValidityFlag } from "../state";
import type { OptionValue } from "./Field";
import type { FieldOption } from "./FieldOption";

export interface FieldSnapshotParams<T, M = never> {
    readonly name: string;
    readonly value: T | undefined;
    readonly ui: UiState;
    readonly errors: readonly string[];
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
    readonly errors: readonly string[];
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
        this.errors = params.errors;
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

    equals(other: FieldSnapshot<T, M>): boolean {
        return this.name === other.name
            && Object.is(this.value, other.value)
            && this.ui.equals(other.ui)
            && this.touched === other.touched
            && this.focused === other.focused
            && this.required === other.required
            && this.submitting === other.submitting
            && this.mounted === other.mounted
            && sameStrings(this.errors, other.errors)
            && sameOptions(this.options, other.options);
    }
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((item, i) => item === b[i]);
}

type ComparableOption = { readonly value: unknown; readonly label: string };

function sameOptions(a: readonly ComparableOption[], b: readonly ComparableOption[]): boolean {
    if (a === b) {
        return true;
    }
    return a.length === b.length
        && a.every((option, i) => option.value === b[i].value && option.label === b[i].label);
}
