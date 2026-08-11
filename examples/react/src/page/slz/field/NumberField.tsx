import { useField } from "../../../form/car-configuration-form";
import { FieldShell } from "../../shared/FieldShell";
import { NumberInput } from "../../shared/input";
import { REQUIRED_MESSAGE, shellId, type FieldsOfType, type SlzFieldProps } from "./props";

export function NumberField(
    props: SlzFieldProps<FieldsOfType<number>> & { min?: number; max?: number; step?: number },
) {
    const { label, hint, min, max, step, ...params } = props;
    const field = useField({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    return (
        <FieldShell
            id={shellId(params.name)} label={label} hint={hint}
            required={field.required} showError={field.showError} error={field.error}
            isLoading={field.isLoading} badges={field.flags}
        >
            <NumberInput
                min={min} max={max} step={step}
                value={field.value} disabled={field.isLocked}
                onChange={field.onChange} onBlur={field.onBlur} onFocus={field.onFocus}
            />
        </FieldShell>
    );
}
