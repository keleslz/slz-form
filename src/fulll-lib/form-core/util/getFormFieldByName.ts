import type { FormStateItem } from "./state";

export function getFormFieldById<Fo extends string, Fi extends string>(form: FormStateItem<Fo, Fi>, id: Fi) {
    return form?.fields[id] || null;
}