import { useField } from "slz-react-form";
import { FieldShell } from "../../shared/FieldShell";
import { FileInput } from "../../shared/input";
import { REQUIRED_MESSAGE, shellId, type SlzFieldProps } from "./props";

export function FileField(props: SlzFieldProps<File> & { accept?: string }) {
    const { label, hint, accept, ...params } = props;
    const field = useField<File>({ requiredMessage: REQUIRED_MESSAGE, ...params });

    if (!field.isVisible) {
        return null;
    }

    return (
        <FieldShell
            id={shellId(params.name)} label={label} hint={hint}
            required={field.required} showError={field.showError} error={field.error}
            isLoading={field.isLoading} badges={field.flags}
        >
            <FileInput accept={accept} disabled={field.isLocked} onChange={field.onChange} onBlur={field.onBlur} />
        </FieldShell>
    );
}
