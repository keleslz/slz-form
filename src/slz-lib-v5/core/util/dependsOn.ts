import type { BehaviorContext, BehaviorResult, IBehavior } from "../behavior";
import type { FieldView } from "../field";

/**
 * Escape hatch for any cross-field reaction the other utils do not cover.
 *
 * The watched names stay explicit, so the dependency remains declared
 * (invariants 7, 23).
 */
export function dependsOn<T = string>(
    watch: readonly string[],
    effect: (ctx: BehaviorContext<T>, dependency: FieldView) => BehaviorResult,
): IBehavior<T> {
    return { watch, onDependencyChanged: effect };
}
