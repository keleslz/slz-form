import type { BehaviorContext, IBehavior } from "../behavior";
import type { FormView } from "../form/FormView";

/**
 * Emits `invisible` while `predicate` holds.
 *
 * The consumer stops rendering the input by reading the flag, rather than
 * branching on another field's value inside the JSX.
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
