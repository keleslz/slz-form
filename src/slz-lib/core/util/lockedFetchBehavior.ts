import type { BehaviorContext, IBehavior } from "../behavior";
import { createBehavior } from "./createBehavior";

/** Side-effect task run once on mount, while the field is locked + loading. */
export type LockedFetchTask = (ctx: BehaviorContext) => Promise<void>;

/**
 * Generic "do something async on mount" behavior: exposes `["loading","locked"]`
 * for the duration of the task and releases the flags when it settles. The task
 * decides what to do (call `ctx.setValue`, populate external state, etc.).
 */
export function lockedFetchBehavior(task: LockedFetchTask): IBehavior {
    return createBehavior({
        onMount: async (ctx) => {
            ctx.pushFlags(["loading", "locked"]);
            try {
                await task(ctx);
            } catch {
                // typically an AbortError on unmount — nothing to do
            }
            return [];
        },
    });
}
