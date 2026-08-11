import type { BehaviorState } from "../state";
import type { AnyFieldView } from "../field/FieldView";
import type { BehaviorContext } from "./BehaviorContext";

/**
 * What a hook may return:
 *   - a `BehaviorState` → replaces this behavior's slice
 *   - a promise of one   → applied on resolution, dropped if the field unmounted
 *   - nothing            → "I don't weigh in", the previous slice is kept
 */
export type BehaviorResult = BehaviorState | Promise<BehaviorState | void> | void;

/**
 * Orchestrates the reactions of one field (invariant 14). It never decides
 * validity — that is the Validator's job (invariant 13).
 *
 * A Behavior is stateless with respect to the field: it *returns* its slice and
 * the FieldController stores it. An instance may carry configuration (a URL, a
 * debounce), never field state — otherwise sharing one instance across two
 * fields would leak state between them.
 */
export interface IBehavior<T = string, M = never> {
    /**
     * Fields this behavior reacts to, by name. Nothing else is readable through
     * `ctx.watched()` (invariants 7, 23).
     */
    readonly watch?: readonly string[];

    onMount?(ctx: BehaviorContext<T, M>): BehaviorResult;
    onChange?(ctx: BehaviorContext<T, M>, value: T | undefined): BehaviorResult;
    onFocus?(ctx: BehaviorContext<T, M>): BehaviorResult;
    onBlur?(ctx: BehaviorContext<T, M>): BehaviorResult;
    onSubmit?(ctx: BehaviorContext<T, M>): BehaviorResult;

    /** Fired when a field listed in `watch` changed. */
    onDependencyChanged?(ctx: BehaviorContext<T, M>, dependency: AnyFieldView): BehaviorResult;

    onUnmount?(ctx: BehaviorContext<T, M>): void;
}

/** Every hook the controller can dispatch without a payload. */
export type BehaviorHook = "onMount" | "onFocus" | "onBlur" | "onSubmit";
