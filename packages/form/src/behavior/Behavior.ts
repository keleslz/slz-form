import type { IBehavior, WatchTarget } from "./IBehavior";

/**
 * Optional base class for behaviors written as classes — carries the `watch`
 * default so subclasses only implement the hooks they care about.
 *
 * Composite behaviors (invariant 18) are built by simply passing several
 * behaviors to a field: each keeps its own slice and the controller merges them.
 */
export abstract class Behavior<T = string, M = never> implements IBehavior<T, M> {
    readonly watch: readonly WatchTarget[] = [];
}
