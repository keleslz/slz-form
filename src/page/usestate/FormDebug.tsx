import type { Errors } from "./validate";
import type { FieldName, Values } from "./values";

export interface FormDebugProps {
    values: Values;
    touched: Partial<Record<FieldName, boolean>>;
    errors: Errors;
    submitting: boolean;
    loading: Readonly<Record<string, boolean>>;
}

function display(value: unknown): string {
    if (value instanceof File) {
        return `File(${value.name}, ${value.size}o)`;
    }
    return value === undefined || value === "" ? "—" : JSON.stringify(value);
}

/**
 * The counterpart of the engine's inspector — and the contrast is the point.
 *
 * There is no form state to read here: the state is scattered across a dozen
 * `useState` inside the form component, so all of it has to be handed down as
 * props. Add a field, and this signature has to follow.
 *
 * "validity" does not exist either; it is re-derived from `touched` + `errors`,
 * with the same rule duplicated from the JSX.
 */
export function FormDebug({ values, touched, errors, submitting, loading }: FormDebugProps) {
    const names = Object.keys(values) as FieldName[];
    const invalid = names.filter((name) => errors[name]);
    const pending = Object.entries(loading).filter(([, isLoading]) => isLoading).map(([key]) => key);

    return (
        <>
            <div className="debug__status">
                <span className="chip">{submitting ? "submitting" : "idle"}</span>
                <span className={`chip chip--${invalid.length === 0 ? "valid" : "error"}`}>
                    {invalid.length === 0 ? "valide" : "incomplet"}
                </span>
                <span className="chip">{names.length} champs</span>
                {pending.map((key) => <span key={key} className="chip chip--loading">{key}</span>)}
            </div>

            <table className="debug__table">
                <tbody>
                    {names.map((name) => {
                        const error = errors[name];
                        const validity = !touched[name] ? "pristine" : error ? "error" : "valid";
                        return (
                            <tr key={name}>
                                <td>{name}</td>
                                <td><code>{display(values[name])}</code></td>
                                <td><span className={`chip chip--${validity}`}>{validity}</span></td>
                                <td className="debug__errors">{touched[name] ? error ?? "" : ""}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <p className="debug__note">
                Cet inspecteur reçoit 5 props parce que l'état n'existe nulle part ailleurs que
                dans le composant formulaire. Côté moteur, il lit <code>form.snapshot</code>.
            </p>
        </>
    );
}
