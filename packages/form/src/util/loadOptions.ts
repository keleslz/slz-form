import type { BehaviorContext, IBehavior } from "../behavior";
import type { FieldOption } from "../field";
import type { BehaviorState } from "../state";

export interface LoadOptionsParams {
    /** Fields whose change should reload the list (dependent selects). */
    watch?: readonly string[];
    /** Lock the input while loading. Default `true`. */
    lock?: boolean;
    /** Clear the current value when a watched field changed. Default `true`. */
    resetOnReload?: boolean;
}

/**
 * "Fetch my options" — the single most common async need of a select, without
 * writing a behavior for it (invariant 17).
 *
 * Covers the whole cycle: `loading` while in flight, locked input, options
 * published on success, back to idle on success *and* on failure.
 */
export function loadOptions<T = string>(
    fetcher: (ctx: BehaviorContext<T>) => Promise<readonly FieldOption[]>,
    params: LoadOptionsParams = {},
): IBehavior<T> {
    const lock = params.lock ?? true;
    const watch = params.watch ?? [];
    const resetOnReload = params.resetOnReload ?? true;

    const load = async (ctx: BehaviorContext<T>): Promise<BehaviorState> => {
        ctx.push(lock ? ctx.state.loading().lock() : ctx.state.loading());
        try {
            const options = await fetcher(ctx);
            if (!ctx.signal.aborted) {
                ctx.setOptions(options);
            }
        } catch {
            if (!ctx.signal.aborted) {
                ctx.setOptions([]);
            }
        }
        return ctx.state.idle().unlock();
    };

    return {
        watch,
        onMount: load,
        onDependencyChanged: watch.length === 0
            ? undefined
            : (ctx) => {
                if (resetOnReload) {
                    ctx.setValue(undefined);
                }
                return load(ctx);
            },
    };
}
