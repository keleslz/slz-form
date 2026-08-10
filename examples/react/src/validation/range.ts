import type { Rule } from "./rule";

export function validateRange(min: number, max: number): Rule<number> {
    return (value) => {
        if (Number.isNaN(value)) {
            return "Valeur numérique attendue";
        }
        if (value < min) {
            return `Minimum ${min}`;
        }
        if (value > max) {
            return `Maximum ${max}`;
        }
        return null;
    };
}
