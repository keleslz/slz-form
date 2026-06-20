import type { IValidator } from "../validator/IValidator";

export type Flag = "pristine" | "loading" | "locked" | "error" | "valid"
/**
 * Read-only view + actions passed to behaviors at each lifecycle hook.
 * Behaviors interact with the field only through this context — no direct
 * access to React, Redux, or any framework primitive.
 */
export interface BehaviorContext {
    readonly signal: AbortSignal;
    readonly validator?: IValidator<string>;
    readonly touched: boolean;
    readonly submitting: boolean;
    readonly name: string;

    getValue(): string;
    setValue(next: string): void;
    getName(): string;
    /**
     * Imperative escape hatch: replaces the calling behavior's flag set at any
     * moment (e.g. to expose a `loading` flag during an async task started in
     * `onMount`, outside the normal hook-return cycle).
     */
    pushFlags(flags: Flag[]): void;
}
