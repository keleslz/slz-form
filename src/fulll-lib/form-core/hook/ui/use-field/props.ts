import type { FieldStateId, FormStateId } from "../../../../../redux";
import type { IBehavior } from "../../../behavior";
import type { IValidator } from "../../../validator";

export interface UseFieldProps {
    formId: FormStateId;
    fieldId: FieldStateId;
    name: string;
    validator: IValidator<string>;
    behaviors?: IBehavior[];
    value?: string;
    required?: boolean;
}
