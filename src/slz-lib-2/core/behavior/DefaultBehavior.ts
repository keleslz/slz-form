import type { StateFlags } from "../state/StateFlag";
import type { BehaviorContext } from "./BehaviorContext";
import type { IBehavior } from "./IBehavior";

/** Default: reflects validator state, never locks. */
export class DefaultBehavior implements IBehavior {
    onMount(): StateFlags { return ["pristine"]; }
    onChange(_v: string, ctx: BehaviorContext): StateFlags { return this.compute(ctx); }
    onBlur(ctx: BehaviorContext): StateFlags { return this.compute(ctx); }
    onSubmit(ctx: BehaviorContext): StateFlags { return this.compute(ctx); }
    onValidationResolved(ctx: BehaviorContext): StateFlags { return this.compute(ctx); }

    private compute(ctx: BehaviorContext): StateFlags {
        const state = ctx.validator?.getState().status;
        if (state === "loading") return ["loading"];
        if (!ctx.touched) return ["pristine"];
        if (state === "error") return ["error"];
        return ["valid"];
    }
}
