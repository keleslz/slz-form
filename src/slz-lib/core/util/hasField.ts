import type { FormStateItem } from "./state";

export function hasField<Fo extends string, Fi extends string>(form: FormStateItem<Fo,Fi>): boolean {
    return Object.keys(form.fields).length > 0;
}