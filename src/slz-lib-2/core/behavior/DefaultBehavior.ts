import type { StateFlags } from "../state/StateFlag";
import type { FieldValue } from "../ui/FieldValue";
import type { BehaviorContext } from "./BehaviorContext";
import type { IBehavior } from "./IBehavior";

/** Default: reflects validator state, never locks. */
export class DefaultBehavior implements IBehavior {
    onMount(): StateFlags { return ["pristine"]; }
    onChange(ctx: BehaviorContext, _v: FieldValue): StateFlags { return this.compute(ctx); }
    onBlur(ctx: BehaviorContext): StateFlags { return this.compute(ctx); }
    onSubmit(ctx: BehaviorContext): StateFlags { return this.compute(ctx); }

    private compute(ctx: BehaviorContext): StateFlags {
        const state = ctx.validator?.getState().status;
        if (state === "loading") return ["loading"];
        if (!ctx.touched) return ["pristine"];
        if (state === "error") return ["error"];
        return ["valid"];
    }
}
