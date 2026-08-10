import type { FieldView } from "../field/FieldView";

export type FormStatus = "idle" | "submitting" | "submitted";

/**
 * Global **read** access to the form (invariant 9).
 *
 * Deliberately has no `subscribe`: reading the form from a behavior must never
 * open a form-wide subscription, otherwise every field would re-render on any
 * change (invariants 10, 11, 22). Reactivity comes from the declared `watch`
 * list, never from this view.
 */
export interface FormView {
    readonly name: string;
    readonly status: FormStatus;
    field(name: string): FieldView | null;
    values(): Readonly<Record<string, unknown>>;
}
