import { lockedFetchBehavior } from "./lockedFetchBehavior";
import type { IBehavior } from "./IBehavior";

/** Async fetcher invoked once at mount; receives the controller's AbortSignal. */
export type PrefillFetcher = (signal: AbortSignal) => Promise<string>;

/**
 * Fetches a value on mount and writes it to the field via `ctx.setValue`.
 * Thin specialization of `lockedFetchBehavior` for the prefill use case.
 */
export function prefillBehavior(fetcher: PrefillFetcher): IBehavior {
    return lockedFetchBehavior(async (ctx) => {
        const value = await fetcher(ctx.signal);
        if (!ctx.signal.aborted) ctx.setValue(value);
    });
}
