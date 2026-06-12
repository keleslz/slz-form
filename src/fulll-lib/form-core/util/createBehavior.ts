import type { IBehavior } from "../behavior/IBehavior";

/**
 * Factory utility to build an `IBehavior` from a partial set of lifecycle hooks
 * without writing a full class. Handy for one-off, inline behaviors such as
 * "on mount, lock the field" or "on submit, expose a loading flag".
 *
 * @example
 *   const lockOnMount = createBehavior({
 *     onMount: () => ["locked"],
 *   });
 */
export function createBehavior(hooks: Partial<IBehavior>): IBehavior {
    return { ...hooks };
}
