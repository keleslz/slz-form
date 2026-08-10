import type { Rule } from "./rule";

export function validateFile(maxBytes: number, accepted: readonly string[]): Rule<File> {
    return (value) => {
        if (value.size > maxBytes) {
            return `Fichier trop volumineux (max ${Math.round(maxBytes / 1024)} Ko)`;
        }
        if (!accepted.includes(value.type)) {
            return `Formats acceptés : ${accepted.join(", ")}`;
        }
        return null;
    };
}
