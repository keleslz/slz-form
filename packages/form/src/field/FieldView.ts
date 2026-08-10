import type { UiState, ValidityFlag } from "../state";
import type { FieldOption } from "./FieldOption";

/**
 * Read-only projection of a field, handed to whoever observes it from the
 * outside: a Behavior reading a declared dependency, or the Form read surface.
 *
 * It exposes exactly the three things invariant 7 asks for — UI state, value,
 * validation state — and nothing that could mutate the field (invariants 6, 8, 20).
 */
export interface FieldView<T = unknown> {
    readonly name: string;
    readonly value: T | undefined;
    readonly ui: UiState;
    readonly validity: ValidityFlag;
    readonly errors: readonly string[];
    readonly options: readonly FieldOption[];
    readonly mounted: boolean;
}
