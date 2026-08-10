export const REQUIRED_MESSAGE = "Champ obligatoire";

export function isEmpty(value: unknown): boolean {
    if (value === undefined || value === null) {
        return true;
    }
    if (typeof value === "string") {
        return value.trim() === "";
    }
    if (Array.isArray(value)) {
        return value.length === 0;
    }
    return false;
}

export function validateRequired(value: unknown): string | null {
    return isEmpty(value) ? REQUIRED_MESSAGE : null;
}
