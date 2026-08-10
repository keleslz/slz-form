import { useField } from "slz-react-form";
import { FieldShell } from "../../shared/FieldShell";
import { SelectInput } from "../../shared/input";
import { REQUIRED_MESSAGE, shellId, type SlzFieldProps } from "./props";

export function SelectField(props: SlzFieldProps<string> & { placeholder?: string }) {
    const { label, hint, placeholder, ...params } = props;
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
            <SelectInput
                placeholder={placeholder} options={field.options}
                value={field.value ?? ""} disabled={field.isLocked}
                onChange={field.onChange} onBlur={field.onBlur} onFocus={field.onFocus}
            />
        </FieldShell>
    );
}
