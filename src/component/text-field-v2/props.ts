import type { FieldStateId, FormStateId } from "../../redux";
import type { IBehavior, IValidator } from "../../slz-lib-2/core";

export type TextFieldProps = {
    name: FieldStateId
    label: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
    formId: FormStateId;
    fieldId: FieldStateId;
    validator?: IValidator;
    behaviors?: IBehavior[]
}