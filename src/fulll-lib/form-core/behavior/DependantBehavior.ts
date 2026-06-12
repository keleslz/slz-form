import { createBehavior } from "../util/createBehavior";
import type { BehaviorContext } from "./BehaviorContext";
import type { IBehavior } from "./IBehavior";

/**
 * Creates a shared behavior that links multiple fields together.
 * Pass the **same** instance to every field that should be part of the group:
 * each field registers itself on mount, and when one changes it notifies all
 * siblings by pushing flags through their stored `BehaviorContext`.
 *
 * @example
 *   const linked = useMemo(() => dependantBehavior(), []);
 *   // then for each linked field:
 *   behaviors={[new DefaultBehavior(), linked]}
 */
export function dependantBehavior(): IBehavior {
    const contexts = new Map<string, BehaviorContext>();
    return createBehavior({
        onMount(ctx) {
            contexts.set(ctx.getName(), ctx);
            return [];
        },
        onChange(_value, ctx) {
            for (const [name, sibling] of contexts) {
                if (name === ctx.getName()) continue;
                sibling.pushFlags(["loading"]);
                setTimeout(() => sibling.pushFlags(["valid"]), 1000);
            }
            return [];
        },
        onUnmount(ctx) {
            contexts.delete(ctx.getName());
        },
    });
}