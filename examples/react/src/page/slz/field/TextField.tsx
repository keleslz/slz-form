import { useField } from "../../../form/car-configuration-form";
import { FieldShell } from "../../shared/FieldShell";
import { TextInput, type TextKind } from "../../shared/input";
import { REQUIRED_MESSAGE, shellId, type FieldsOfType, type SlzFieldProps } from "./props";

export function TextField(
    props: SlzFieldProps<FieldsOfType<string>> & { kind?: TextKind; placeholder?: string; suggest?: boolean },
) {
    const { label, hint, kind, placeholder, suggest, ...params } = props;
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
            <TextInput
                kind={kind} placeholder={placeholder}
                value={field.value ?? ""} disabled={field.hasFlag("locked")}
                suggestions={suggest ? field.options : undefined}
                onChange={field.onChange} onBlur={field.onBlur} onFocus={field.onFocus}
            />
        </FieldShell>
    );
}
