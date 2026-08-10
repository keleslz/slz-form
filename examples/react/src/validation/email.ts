import type { Rule } from "./rule";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const validateEmail: Rule<string> = (value) =>
    EMAIL.test(value) ? null : "Adresse email invalide";
