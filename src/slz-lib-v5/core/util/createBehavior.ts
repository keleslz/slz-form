import type { IBehavior } from "../behavior";

/**
 * Identity function that gives a behavior literal its type without forcing a
 * class. Behaviors written as bare functions stay bare (invariant 16).
 */
export function createBehavior<T = string>(definition: IBehavior<T>): IBehavior<T> {
    return definition;
}
