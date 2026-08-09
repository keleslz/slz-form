import type { BehaviorContext, BehaviorResult, IBehavior } from "../behavior";
import type { FieldView } from "../field";
import type { FormView } from "../form/FormView";

/**
 * Locks the field while `condition` holds.
 *
 * Note that locking during submission is already handled by the controller —
 * this is for consumer-specific conditions ("locked until the country is set").
 */
export function lockWhile<T = string>(
    condition: (ctx: BehaviorContext<T>) => boolean,
    watch: readonly string[] = [],
): IBehavior<T> {
    const compute = (ctx: BehaviorContext<T>) => (condition(ctx) ? ctx.state.lock() : ctx.state.unlock());
    return {
        watch,
        onMount: compute,
        onChange: compute,
        onBlur: compute,
        onSubmit: compute,
        onDependencyChanged: compute,
    };
}

/**
 * Emits `invisible` while `predicate` holds — the consumer stops rendering the
 * input by reading the flag, not by branching on another field in the JSX.
 */
export function hideWhen<T = string>(
    watch: readonly string[],
    predicate: (form: FormView) => boolean,
): IBehavior<T> {
    const compute = (ctx: BehaviorContext<T>) => (predicate(ctx.form) ? ctx.state.hide() : ctx.state.show());
    return {
        watch,
        onMount: compute,
        onDependencyChanged: compute,
    };
}

/**
 * Escape hatch for any other cross-field reaction. The watched names are
 * explicit, so the dependency stays declared (invariants 7, 23).
 */
export function dependsOn<T = string>(
    watch: readonly string[],
    effect: (ctx: BehaviorContext<T>, dependency: FieldView) => BehaviorResult,
): IBehavior<T> {
    return { watch, onDependencyChanged: effect };
}
