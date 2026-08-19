/**
 * UI flags are grouped by **axis**. Two flags of the same axis are mutually
 * exclusive; two flags of different axes compose freely.
 *
 * This is what makes the merge of several behaviors deterministic: a naive
 * `Set` union can produce `["pristine", "error"]`, which is not a state.
 */

/** Validity axis — exclusive. Produced by the Validator only, never by a Behavior. */
export type ValidityFlag = "pristine" | "valid" | "error";

/** Activity axis — exclusive. `loading` as soon as one behavior (or the validator) is in flight. */
export type ActivityFlag = "idle" | "loading";

/**
 * Availability axis — cumulative, each entry is an independent dimension.
 *
 * `locked` grise le champ et le sort de la saisie ; `readonly` le laisse
 * lisible et sélectionnable mais non modifiable. Les deux se cumulent avec
 * `invisible` sans se contredire, d'où l'axe cumulatif.
 */
export type AvailabilityFlag = "locked" | "readonly" | "invisible";

/** Flat read surface: what `hasFlag(...)` accepts. */
export type UiFlag = ValidityFlag | ActivityFlag | AvailabilityFlag;

export const VALIDITY_FLAGS: readonly ValidityFlag[] = ["pristine", "valid", "error"];
export const ACTIVITY_FLAGS: readonly ActivityFlag[] = ["idle", "loading"];
export const AVAILABILITY_FLAGS: readonly AvailabilityFlag[] = ["locked", "readonly", "invisible"];
