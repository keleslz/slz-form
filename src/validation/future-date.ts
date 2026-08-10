import type { Rule } from "./rule";

/** Works for `date` and `datetime-local`: the input hands back an ISO-ish string. */
export const validateFutureDate: Rule<string> = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "Date invalide";
    }
    return parsed.getTime() < Date.now() ? "La date doit être dans le futur" : null;
};
