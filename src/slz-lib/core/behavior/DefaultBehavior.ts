import type { UIFlag } from "../util";
import type { BehaviorContext } from "./BehaviorContext";
import type { IBehavior } from "./IBehavior";

/** Default: reflects validator state, never locks. */
export class DefaultBehavior implements IBehavior {
    onMount(): UIFlag[] { return ["pristine"]; }
    onChange(_v: string, ctx: BehaviorContext): UIFlag[] { return this.compute(ctx); }
    onBlur(ctx: BehaviorContext): UIFlag[] { return this.compute(ctx); }
    onSubmit(ctx: BehaviorContext): UIFlag[] { return this.compute(ctx); }
    onValidationResolved(ctx: BehaviorContext): UIFlag[] { return this.compute(ctx); }

    private compute(ctx: BehaviorContext): UIFlag[] {
        const state = ctx.validator?.getState().status;
        if (state === "loading") return ["loading"];
        if (!ctx.touched) return ["pristine"];
        if (state === "error") return ["error"];
        return ["valid"];
    }
}
