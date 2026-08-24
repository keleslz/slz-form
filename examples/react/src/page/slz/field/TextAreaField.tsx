import { useField } from "../../../form/car-configuration-form";
import { FieldShell } from "../../shared/FieldShell";
import { TextAreaInput } from "../../shared/input";
import { REQUIRED_MESSAGE, shellId, type FieldsOfType, type SlzFieldProps } from "./props";

export function TextAreaField(
    props: SlzFieldProps<FieldsOfType<string>> & { rows?: number },
) {
    const { label, hint, rows, ...params } = props;
    const field = useField({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (field.hasFlag("invisible")) {
        return null;
    }

    return (
        <FieldShell
            id={shellId(params.name)} label={label} hint={hint}
            required={field.hasFlag("required")} showError={field.hasFlag("error")} error={field.error}
            isLoading={field.hasFlag("loading")} badges={field.flags}
        >
            <TextAreaInput
                rows={rows} value={field.value ?? ""} disabled={field.hasFlag("locked")}
                onChange={field.onChange} onBlur={field.onBlur} onFocus={field.onFocus}
            />
        </FieldShell>
    );
}
