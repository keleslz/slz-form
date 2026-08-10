import type { BehaviorState, UiState } from "../state";
import type { FieldOption } from "../field/FieldOption";
import type { FieldView } from "../field/FieldView";
import type { FormView } from "../form/FormView";

/**
 * What a Behavior is given at each lifecycle hook. Read-only on everything it
 * does not own (invariant 8); the only writes it can perform target its own
 * field (invariants 5, 6, 20).
 */
export interface BehaviorContext<T = string> {
    readonly name: string;

    /**
     * This behavior's own current slice. Live getter, so it stays accurate
     * across an `await` — `ctx.state.loading()` before a call and
     * `ctx.state.idle()` after both read the real current value.
     */
    readonly state: BehaviorState;

    /**
     * The field's merged state: every behavior's contribution plus the
     * validator, deduplicated and axis-resolved. This is what lets a behavior
     * decide from the *current* context rather than from its own slice alone.
     */
    readonly ui: UiState;

    /** Global read access to the form — no subscription (invariants 9, 10). */
    readonly form: FormView;

    /** Aborted on unmount: guard after every `await`. */
    readonly signal: AbortSignal;

    getValue(): T | undefined;

    /**
     * Writes this field's value. Does **not** mark it touched — a value coming
     * from a prefill or a dependency is not a user interaction.
     */
    setValue(next: T | undefined): void;

    /** Publishes the option list (select / multi-select / radio). */
    setOptions(options: readonly FieldOption[]): void;

    /**
     * Reads a field declared in `watch`. Throws on an undeclared name: a
     * reactive dependency must be explicit (invariants 7, 23).
     */
    watched(name: string): FieldView | null;

    /**
     * Publishes an intermediate state outside the hook's return value — the
     * only way to show `loading` *during* an API call, since nothing is
     * returned while awaiting.
     */
    push(state: BehaviorState): void;
}
