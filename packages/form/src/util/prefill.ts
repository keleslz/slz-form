import type { BehaviorContext, IBehavior } from "../behavior";

/**
 * Fills the field from an API on mount, locked and `loading` meanwhile.
 *
 * The write goes through `ctx.setValue`, which does not mark the field touched:
 * a prefilled value is not a user interaction, so the field stays `pristine`.
 */
export function prefill<T = string>(
    fetcher: (ctx: BehaviorContext<T>) => Promise<T | undefined>,
): IBehavior<T> {
    return {
        onMount: async (ctx) => {
            ctx.push(ctx.state.loading().lock());
            try {
                const value = await fetcher(ctx);
                if (!ctx.signal.aborted && value !== undefined) {
                    ctx.setValue(value);
                }
            } catch {
                // Leave the field empty: a failed prefill is not a validation error.
            }
            return ctx.state.idle().unlock();
        },
    };
}
