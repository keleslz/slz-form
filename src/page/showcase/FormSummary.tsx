import { CAR_CONFIGURATION_FORM } from "../../form";
import { useForm } from "../../slz-lib-v5/react";
import { countRender } from "./renderCounter";

function render(value: unknown): string {
    if (value instanceof File) {
        return `File(${value.name}, ${value.size}o)`;
    }
    if (value === undefined) {
        return "—";
    }
    return JSON.stringify(value);
}

/**
 * The only component subscribed to the whole form. Reading the form is opt-in:
 * a Field never does it, which is why typing here does not re-render the inputs
 * (invariants 10, 11, 22).
 */
export function FormSummary() {
    const { snapshot, isValid, isSubmitting, submit, reset } = useForm(CAR_CONFIGURATION_FORM);

    const renders = countRender("__form__");

    return (
        <section className="panel panel--summary">
            <h2>
                État du formulaire
                <span className="chip chip--renders" title="rendus de ce panneau">↻ {renders}</span>
            </h2>

            <div className="summary__status">
                <span className={`chip chip--${isValid ? "valid" : "error"}`}>
                    {isValid ? "valide" : "incomplet"}
                </span>
                <span className="chip">{snapshot.status}</span>
            </div>

            <table className="summary__table">
                <tbody>
                    {snapshot.fields.map((field) => (
                        <tr key={field.name} className={field.mounted ? "" : "is-unmounted"}>
                            <td>{field.name}</td>
                            <td><code>{render(field.value)}</code></td>
                            <td><span className={`chip chip--${field.validity}`}>{field.validity}</span></td>
                            <td className="summary__errors">{field.errors[0] ?? ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="summary__actions">
                <button type="button" onClick={() => void submit()} disabled={isSubmitting}>
                    {isSubmitting ? "Envoi…" : "Soumettre"}
                </button>
                <button type="button" className="ghost" onClick={reset}>
                    Réinitialiser
                </button>
            </div>
        </section>
    );
}
