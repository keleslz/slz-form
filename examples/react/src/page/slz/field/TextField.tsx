import { useField } from "slz-react-form";
import { FieldShell } from "../../shared/FieldShell";
import { TextInput, type TextKind } from "../../shared/input";
import { REQUIRED_MESSAGE, shellId, type SlzFieldProps } from "./props";

export function TextField(props: SlzFieldProps<string> & { kind?: TextKind; placeholder?: string }) {
    const { label, hint, kind, placeholder, ...params } = props;
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
            <TextInput
                kind={kind} placeholder={placeholder}
                value={field.value ?? ""} disabled={field.isLocked}
                onChange={field.onChange} onBlur={field.onBlur} onFocus={field.onFocus}
            />
        </FieldShell>
    );
}
