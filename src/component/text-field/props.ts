import type { IBehavior } from "../../slz-lib/react-slz-form/behavior/IBehavior";
import type { FieldStateId, FormStateId } from "../../redux";
import type { IValidator } from "../../slz-lib/react-slz-form/validator/IValidator";

export type TextFieldProps = {
    name: FieldStateId
    label: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
    formId: FormStateId;
    validator: IValidator<string>;
    behaviors?: IBehavior[]
}