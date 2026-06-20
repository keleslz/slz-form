import type { FormState } from "../ui";

export function getFormFieldById<Fo extends string, Fi extends string>(
    forms: FormState<Fo, Fi>,
    formId: Fo,
    fieldId: Fi,
) {
    return forms?.[formId].fields?.[fieldId] || null;
}