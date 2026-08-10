import { useField } from "slz-react-form";
import { FieldShell } from "../../shared/FieldShell";
import { RadioInput } from "../../shared/input";
import { REQUIRED_MESSAGE, shellId, type SlzFieldProps } from "./props";

export function RadioField(props: SlzFieldProps<string>) {
    const { label, hint, ...params } = props;
    const field = useField<string>({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    return (
        <FieldShell
            id={shellId(params.name)} label={label} hint={hint}
            required={field.required} showError={field.showError} error={field.error}
            isLoading={field.isLoading} badges={field.flags}
        >
            <RadioInput
                name={`slz-${field.name}`} options={field.options}
                value={field.value ?? ""} disabled={field.isLocked}
                onChange={field.onChange} onBlur={field.onBlur}
            />
        </FieldShell>
    );
}
