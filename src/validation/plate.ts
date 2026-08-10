import type { Rule } from "./rule";

const PLATE = /^[A-Z]{2}-\d{3}-[A-Z]{2}$/;

export const validatePlateFormat: Rule<string> = (value) =>
    PLATE.test(value.toUpperCase()) ? null : "Format attendu : AB-123-CD";

export const PLATE_TAKEN = "Cette plaque est déjà enregistrée";
