import { lockWhile } from "../car-configuration-form";

/** Verrouillage inter-champs, sans jamais muter le champ observé. */
export const lockedUntilConsent = lockWhile({
    watch: ["consent"],
    when: ({ consent }) => consent !== true,
});
