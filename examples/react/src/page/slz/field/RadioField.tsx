import { useField } from "../../../form/car-configuration-form";
import { FieldShell } from "../../shared/FieldShell";
import { RadioInput } from "../../shared/input";
import { REQUIRED_MESSAGE, shellId, type PlainFieldsOfType, type SlzFieldProps } from "./props";

/**
 * Restreint aux champs sans meta : la vue passe ici une liste statique, qui ne
 * pourrait pas porter les données métier qu'un autre champ déclare.
 */
export function RadioField(props: SlzFieldProps<PlainFieldsOfType<string>>) {
    const { label, hint, ...params } = props;
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
            <RadioInput
                name={`slz-${field.name}`} options={field.options}
                value={field.value ?? ""} disabled={field.hasFlag("locked")}
                onChange={field.onChange} onBlur={field.onBlur}
            />
        </FieldShell>
    );
}
