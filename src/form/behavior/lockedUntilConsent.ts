import { lockWhile } from "../../slz-lib-v5/core";

/** Cross-field lock, with no mutation of the watched field (invariants 6, 20). */
export const lockedUntilConsent = lockWhile(
    (ctx) => ctx.watched("consent")?.value !== true,
    ["consent"],
);
