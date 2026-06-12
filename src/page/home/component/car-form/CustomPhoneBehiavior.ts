import type { BehaviorContext, IBehavior, UIFlag } from "../../../../slz-lib";

/**
 * Form-specific behavior: while the phone is being validated remotely, lock
 * the input so the user can't change it mid-flight. This lives next to the
 * form that uses it — the framework only exposes the IBehavior contract.
 */
export class CustomPhoneBehavior implements IBehavior {
    onMount(): UIFlag[] { return ["pristine"]; }
    onChange(_v: string, ctx: BehaviorContext): UIFlag[] { return this.compute(ctx); }
    onBlur(ctx: BehaviorContext): UIFlag[] { return this.compute(ctx); }
    onSubmit(ctx: BehaviorContext): UIFlag[] { return this.compute(ctx); }
    onValidationResolved(ctx: BehaviorContext): UIFlag[] { return this.compute(ctx); }

    private compute(ctx: BehaviorContext): UIFlag[] {
        const state = ctx.validator.getState().status;
        if (state === "loading") return ["loading", "locked"];
        if (!ctx.touched) return ["pristine"];
        if (state === "error") return ["error"];
        return ["valid"];
    }
}