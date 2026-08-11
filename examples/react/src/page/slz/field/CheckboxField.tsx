import { useField } from "../../../form/car-configuration-form";
import { FieldShell } from "../../shared/FieldShell";
import { CheckboxInput } from "../../shared/input";
import { REQUIRED_MESSAGE, shellId, type FieldsOfType, type SlzFieldProps } from "./props";

export function CheckboxField(
    props: SlzFieldProps<FieldsOfType<boolean>>) {
    const { label, hint, ...params } = props;
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
            <CheckboxInput
                checked={field.value ?? false} disabled={field.isLocked}
                onChange={field.onChange} onBlur={field.onBlur}
            />
        </FieldShell>
    );
}
