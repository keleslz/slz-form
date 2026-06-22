import type { FieldValue } from "../ui/FieldValue";
import type { BehaviorContext } from "./BehaviorContext";
import type { BehaviorResult } from "./BehaviorResult";


/**
 * Lifecycle-driven behavior contract. Every hook is optional; the controller
 * calls them at the matching event and stores the returned flag set per behavior.
 * The active UI flag set is the union of every behavior's current flags.
 */
export interface IBehavior {
    onMount?(ctx: BehaviorContext): BehaviorResult;
    onChange?(ctx: BehaviorContext, value: FieldValue): BehaviorResult;
    onFocus?(ctx: BehaviorContext): BehaviorResult;
    onBlur?(ctx: BehaviorContext): BehaviorResult;
    onSubmit?(ctx: BehaviorContext): BehaviorResult;
    onUnmount?(ctx: BehaviorContext): void;
}
