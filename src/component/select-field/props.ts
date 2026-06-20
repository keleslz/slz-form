import type { IBehavior } from "../../slz-lib";
import type { FieldStateId, FormStateId } from "../../redux";
import type { IValidator } from "../../slz-lib/react-core/validator/IValidator";

export type SelectOption = { label: string; value: string };

export type SelectFieldProps = {
    name: FieldStateId;
    label: string;
    /** Static options. Ignored if `optionsFetcher` is provided. */
    options?: SelectOption[];
    /** Async options provider. Runs once on mount; locks the field meanwhile. */
    optionsFetcher?: (signal: AbortSignal) => Promise<SelectOption[]>;
    /** Value to pre-select once the fetched options have arrived. */
    defaultValue?: string;
    value?: string;
    required?: boolean;
    formId: FormStateId;
    validator: IValidator<string>;
    behaviors?: IBehavior[];
}
