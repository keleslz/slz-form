import { hideWhen, loadOptions, lockWhile, prefill } from "../../slz-lib-v5/core";
import { fetchBrands, fetchCustomerReference, fetchModels, fetchOptionPacks } from "../../form/api";

/**
 * Behaviors are declared once, at module scope: an instance carries
 * configuration, never field state, so sharing one across fields is safe.
 *
 * Every cross-field reaction here goes through an explicit `watch` list — the
 * engine throws if a behavior reads a field it did not declare (invariants 7, 23).
 */

/** Plain async fetch, no dependency. */
export const brandOptions = loadOptions(fetchBrands);

/** Dependent select: reloads and clears itself whenever `brand` changes. */
export const modelOptions = loadOptions(
    (ctx) => fetchModels(ctx.watched("brand")?.value as string | undefined),
    { watch: ["brand"] },
);

export const packOptions = loadOptions<string[]>(fetchOptionPacks);

/** Fills the field from the API, locked and loading meanwhile, without marking it touched. */
export const customerReferencePrefill = prefill(fetchCustomerReference);

/** Emits `invisible`: the view stops rendering the input by reading the flag. */
export const onlyWhenBrandIsOther = hideWhen(["brand"], (form) => form.field("brand")?.value !== "other");

/** Cross-field lock, with no mutation of the watched field (invariants 6, 20). */
export const lockedUntilConsent = lockWhile(
    (ctx) => ctx.watched("consent")?.value !== true,
    ["consent"],
);
