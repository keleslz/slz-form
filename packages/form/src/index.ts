/**
 * Surface publique de `slz-form`.
 *
 * Volontairement **explicite** plutôt qu'un `export *` : tout ce qui sort d'ici
 * devient un contrat de version à la première publication. `DependencyGraph`,
 * `Lifecycle`, `FieldHost` et les helpers de `watch` sont des rouages internes
 * et n'y figurent pas.
 */

// ── état de l'UI ──────────────────────────────────────────────────────────
export { BehaviorState } from "./state/BehaviorState";
export { UiState } from "./state/UiState";
export type {
    ActivityFlag,
    AnyUiFlag,
    AvailabilityFlag,
    BehaviorFlag,
    MarkerFlag,
    UiFlag,
    ValidityFlag,
} from "./state/UiFlag";
export {
    ACTIVITY_FLAGS,
    BEHAVIOR_FLAGS,
    isReservedFlag,
    MARKER_FLAGS,
    RESERVED_FLAGS,
    VALIDITY_FLAGS,
} from "./state/UiFlag";

// ── validation ────────────────────────────────────────────────────────────
export {
    IValidator,
    ValidationReport,
} from "./validator/IValidator";
export type {
    IssueMeta,
    IssueSeverity,
    ValidationContext,
    ValidationIssue,
    ValidationOptions,
    ValidatorListener,
    ValidatorState,
    ValidatorStatus,
} from "./validator/IValidator";
export { DefaultValidator } from "./validator/DefaultValidator";
export { DebouncedValidator } from "./validator/DebouncedValidator";
export { ExternalValidator } from "./validator/ExternalValidator";

// ── behaviors ─────────────────────────────────────────────────────────────
export { Behavior } from "./behavior/Behavior";
export type {
    BehaviorHook,
    BehaviorResult,
    FieldChanges,
    IBehavior,
    WatchTarget,
    WatchTrigger,
} from "./behavior/IBehavior";
export type { BehaviorContext } from "./behavior/BehaviorContext";

// ── champs ────────────────────────────────────────────────────────────────
export { FieldController } from "./field/FieldController";
export type { FieldParams, FieldUpdate } from "./field/FieldController";
export { FieldSnapshot } from "./field/FieldSnapshot";
export type { FieldSnapshotParams } from "./field/FieldSnapshot";
export type { FieldOption } from "./field/FieldOption";
export type { AnyFieldView, FieldView } from "./field/FieldView";
export type {
    Field,
    FieldsShape,
    MetaOf,
    OptionValue,
    OptionValueOf,
    ValueOf,
    WatchedValues,
} from "./field/Field";

// ── formulaires ───────────────────────────────────────────────────────────
export { FormController } from "./form/FormController";
export type { FieldNameOf, FormParams } from "./form/FormController";
export { FormRegister } from "./form/FormRegister";
export { FormSnapshot } from "./form/FormSnapshot";
export type { ArraySummary, FieldSummary } from "./form/FormSnapshot";
export type { FormStatus, FormView } from "./form/FormView";
export type {
    FormFlag,
    FormMarkerFlag,
    FormSubmissionFlag,
    FormValidityFlag,
} from "./form/FormFlag";

// ── listes répétables ─────────────────────────────────────────────────────
export { FieldArrayController } from "./array/FieldArrayController";
export { FieldArrayRow } from "./array/FieldArrayRow";
export type { ArrayNameOf, FieldArray, PlainNameOf, RowOf } from "./array/FieldArray";

// ── utilitaires ───────────────────────────────────────────────────────────
export { behaviorsFor } from "./util/behaviorsFor";
export { createBehavior } from "./util/createBehavior";
export { dependsOn } from "./util/dependsOn";
export { hideWhen } from "./util/hideWhen";
export { loadOptions } from "./util/loadOptions";
export type { LoadOptionsParams, LoadOptionsTrigger } from "./util/loadOptions";
export { lockWhile } from "./util/lockWhile";
export { lookup } from "./util/lookup";
export type { LookupParams } from "./util/lookup";
export { lockedWhilePending, openWhilePending } from "./util/pending";
export type { PendingState } from "./util/pending";
export { prefill } from "./util/prefill";
