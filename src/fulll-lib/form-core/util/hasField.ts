import type { FormStateItem } from "./state";

export function hasField<T extends string>(form: FormStateItem<T>): boolean {
    return Object.keys(form.fields).length > 0;
}