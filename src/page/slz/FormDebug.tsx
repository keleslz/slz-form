import { CAR_CONFIGURATION_FORM } from "../../form";
import { useForm } from "../../slz-lib-v5/react";

function display(value: unknown): string {
    if (value instanceof File) {
        return `File(${value.name}, ${value.size}o)`;
    }
    return value === undefined ? "—" : JSON.stringify(value);
}

/**
 * The whole inspector reads a single object: `form.snapshot`. There is nothing
 * else to gather — the engine already holds the form's state at an instant T.
 */
export function FormDebug() {
    const { snapshot } = useForm(CAR_CONFIGURATION_FORM);

    return (
        <>
            <div className="debug__status">
                <span className="chip">{snapshot.status}</span>
                <span className={`chip chip--${snapshot.isValid ? "valid" : "error"}`}>
                    {snapshot.isValid ? "valide" : "incomplet"}
                </span>
                <span className="chip">{snapshot.fields.length} champs</span>
            </div>

            <table className="debug__table">
                <tbody>
                    {snapshot.fields.map((field) => (
                        <tr key={field.name} className={field.mounted ? "" : "is-unmounted"}>
                            <td>{field.name}</td>
                            <td><code>{display(field.value)}</code></td>
                            <td><span className={`chip chip--${field.validity}`}>{field.validity}</span></td>
                            <td className="debug__errors">{field.errors[0] ?? ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}
