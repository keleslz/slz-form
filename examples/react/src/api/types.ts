/**
 * Shape returned by the option endpoints.
 *
 * Deliberately declared here and not imported from the lib: the useState
 * implementation must be able to consume the same API without pulling
 * `slz-form` in, otherwise the comparison would be rigged. It is
 * structurally compatible with `FieldOption`.
 */
export interface Option {
    readonly value: string;
    readonly label: string;
    readonly disabled?: boolean;
}
