import { useField } from "../../../form/car-configuration-form";
import { FieldShell } from "../../shared/FieldShell";
import { TextAreaInput } from "../../shared/input";
import { REQUIRED_MESSAGE, shellId, type FieldsOfType, type SlzFieldProps } from "./props";

export function TextAreaField(
    props: SlzFieldProps<FieldsOfType<string>> & { rows?: number },
) {
    const { label, hint, rows, ...params } = props;
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
            <TextAreaInput
                rows={rows} value={field.value ?? ""} disabled={field.isLocked}
                onChange={field.onChange} onBlur={field.onBlur} onFocus={field.onFocus}
            />
        </FieldShell>
    );
}
