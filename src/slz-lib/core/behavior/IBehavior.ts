import type { UIFlag } from "../util";
import type { BehaviorContext } from "./BehaviorContext";

export type BehaviorResult = UIFlag[] | Promise<UIFlag[]>;

/**
 * Lifecycle-driven behavior contract. Every hook is optional; the controller
 * calls them at the matching event and stores the returned flag set per behavior.
 * The active UI flag set is the union of every behavior's current flags.
 */
export interface IBehavior {
    onMount?(ctx: BehaviorContext): BehaviorResult;
    onChange?(value: string, ctx: BehaviorContext): BehaviorResult;
    onBlur?(ctx: BehaviorContext): BehaviorResult;
    onSubmit?(ctx: BehaviorContext): BehaviorResult;
    onValidationResolved?(ctx: BehaviorContext): BehaviorResult;
    onUnmount?(ctx: BehaviorContext): void;
}
