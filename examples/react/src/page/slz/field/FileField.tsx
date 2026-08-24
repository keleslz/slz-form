import { useField } from "../../../form/car-configuration-form";
import { FieldShell } from "../../shared/FieldShell";
import { FileInput } from "../../shared/input";
import { REQUIRED_MESSAGE, shellId, type FieldsOfType, type SlzFieldProps } from "./props";

export function FileField(
    props: SlzFieldProps<FieldsOfType<File>> & { accept?: string },
) {
    const { label, hint, accept, ...params } = props;
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
            <FileInput accept={accept} disabled={field.hasFlag("locked")}
                onChange={field.onChange} onBlur={field.onBlur} />
        </FieldShell>
    );
}
