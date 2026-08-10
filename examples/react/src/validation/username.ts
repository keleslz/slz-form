import type { Rule } from "./rule";

export const validateUsernameFormat: Rule<string> = (value) =>
    /^[a-z0-9_-]{3,20}$/i.test(value)
        ? null
        : "3 à 20 caractères : lettres, chiffres, tiret ou underscore";

export const USERNAME_TAKEN = "Ce nom est déjà pris";
