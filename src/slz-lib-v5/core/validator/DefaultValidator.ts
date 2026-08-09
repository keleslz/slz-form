import { IValidator } from "./IValidator";

/**
 * Attached automatically when a field declares no validator.
 *
 * It carries no rule of its own — `required` is handled by the base class — but
 * it keeps a single, uniform path for validity: the Validator is *always* the
 * authority, so the FieldController never has to special-case its absence
 * (invariants 13 and 16).
 */
export class DefaultValidator<T = string> extends IValidator<T> {
    protected validate(): void {
        // No rule: presence is enforced by `IValidator` from the `required` option.
    }
}
