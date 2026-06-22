import type { StateFlags } from "../state";
import type { FieldValue } from "../ui/FieldValue";
import type { IValidator } from "../validator/IValidator";

/**
 * Read-only view + actions passed to behaviors at each lifecycle hook.
 * Behaviors interact with the field only through this context — no direct
 * access to React, Redux, or any framework primitive.
 */
export interface BehaviorContext {
    readonly validator?: IValidator;
    readonly name: string;
    readonly touched: boolean;

    getValue(): FieldValue | undefined;
    setValue(next?: FieldValue): void;
    getName(): string;
    /**
     * Imperative escape hatch: replaces the calling behavior's flag set at any
     * moment (e.g. to expose a `loading` flag during an async task started in
     * `onMount`, outside the normal hook-return cycle).
     */
    pushFlags(flags: StateFlags): void;
}
