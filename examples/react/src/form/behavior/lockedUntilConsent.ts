import { lockWhile } from "slz-form";

/** Cross-field lock, with no mutation of the watched field (invariants 6, 20). */
export const lockedUntilConsent = lockWhile(
    (ctx) => ctx.watched("consent")?.value !== true,
    ["consent"],
);
