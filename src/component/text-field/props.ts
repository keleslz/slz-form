import type { FieldStateId, FormStateId } from "../../redux";
import type { IBehavior, IValidator } from "../../slz-lib/core";

export type TextFieldProps = {
    name: FieldStateId
    label: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
    formId: FormStateId;
    validator?: IValidator<string>;
    behaviors?: IBehavior[]
}