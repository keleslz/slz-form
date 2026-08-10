import type { Rule } from "./rule";

/**
 * `required` cannot express "must be checked": `false` is a value, not an
 * absence. The rule has to be explicit.
 */
export const validateConsent: Rule<boolean> = (value) =>
    value ? null : "Vous devez accepter les conditions";
