import type { FieldState, FormStateItem } from "./state";

export function hasFieldError<Fo extends string, Fi extends string>(form: FormStateItem<Fo, Fi>): boolean {
    const fields = Object.values(form.fields) as FieldState<Fi>[];
    return fields.some(
        field => field.status.value === "error",
    );
}