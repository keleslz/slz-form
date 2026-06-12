import { createBehavior } from "./createBehavior";
import type { BehaviorContext } from "../behavior/BehaviorContext";
import type { IBehavior } from "../behavior/IBehavior";
import type { UIFlag } from "../hook/ui/use-field/UiFlag";

/**
 * The conditions under which a field can be locked.
 * - `"loading"` — the field's validator is in a loading state (async validation in flight)
 * - `"submitting"` — the parent form is currently being submitted
 */
export type LockCondition = "loading" | "submitting";

function isLocked(conditions: LockCondition[], ctx: BehaviorContext): boolean {
    return conditions.some((c) => {
        if (c === "loading") return ctx.validator.getState().status === "loading";
        if (c === "submitting") return ctx.submitting;
    });
}

/**
 * Emits the `"locked"` flag whenever **any** of the given conditions is met.
 *
 * @example
 *   // Lock only while async validation runs
 *   lockWhile(["loading"])
 *
 *   // Lock during async validation AND form submission
 *   lockWhile(["loading", "submitting"])
 */
export function lockWhile(conditions: LockCondition[]): IBehavior {
    const compute = (ctx: BehaviorContext) =>
        isLocked(conditions, ctx) ? (["locked"] as UIFlag[]) : [];

    return createBehavior({
        onMount: (ctx) => compute(ctx),
        onChange: (_v, ctx) => compute(ctx),
        onBlur: (ctx) => compute(ctx),
        onSubmit: (ctx) => compute(ctx),
        onValidationResolved: (ctx) => compute(ctx),
    });
}
