import { useForm } from "../../form/car-configuration-form";
import { countRender } from "../shared/renderCounter";

/**
 * The only piece of this tab subscribed to the whole form. Fields never are,
 * which is why typing does not re-render them all.
 */
export function FormActions() {
    const { isValid, isSubmitting, submit, reset } = useForm();
    const renders = countRender("slz:actions");

    return (
        <div className="actions">
            <span className={`chip chip--${isValid ? "valid" : "error"}`}>
                {isValid ? "valide" : "incomplet"}
            </span>
            <button type="button" onClick={() => void submit()} disabled={isSubmitting}>
                {isSubmitting ? "Envoi…" : "Soumettre"}
            </button>
            <button type="button" className="ghost" onClick={reset}>Réinitialiser</button>
            <span className="chip chip--renders" title="rendus de cette barre">↻ {renders}</span>
        </div>
    );
}
