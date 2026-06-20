import type { FieldStateId, FormStateId } from "../../../../../redux";
import type { IBehavior, IValidator } from "../../../../core";

export interface UseFieldProps {
    formId: FormStateId;
    fieldId: FieldStateId;
    name: string;
    validator?: IValidator<string>;
    behaviors?: IBehavior[];
    value?: string;
    required?: boolean;
}
