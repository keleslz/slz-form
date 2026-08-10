import type { Rule } from "./rule";

export function validateMaxSelection(max: number): Rule<string[]> {
    return (value) => (value.length > max ? `${max} options maximum` : null);
}
