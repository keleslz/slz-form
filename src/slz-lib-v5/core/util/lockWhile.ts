import type { BehaviorContext, IBehavior } from "../behavior";

/**
 * Locks the field while `condition` holds.
 *
 * Locking during submission is already handled by the controller — this covers
 * consumer-specific conditions ("locked until the country is set"). Pass the
 * fields the condition reads in `watch`, otherwise it will not be re-evaluated
 * when they change.
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
