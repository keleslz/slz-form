import { useForm } from "../../form/car-configuration-form";
import { countRender } from "../shared/renderCounter";

/**
 * The only piece of this tab subscribed to the whole form. Fields never are,
 * which is why typing does not re-render them all.
 */
export function FormActions() {
    const { hasFlag, submit, reset } = useForm();
    const renders = countRender("slz:actions");

    return (
        <div className="actions">
            <span className={`chip chip--${hasFlag("valid") ? "valid" : "error"}`}>
                {hasFlag("valid") ? "valide" : "incomplet"}
            </span>
            {/* Strictement l'ancien comportement : seul l'envoi en cours désactive.
                Un formulaire qui veut aussi bloquer tant qu'il est incomplet
                écrit `!hasFlag("valid", "idle")` — un seul appel. */}
            <button type="button" onClick={() => void submit()} disabled={hasFlag("submitting")}>
                {hasFlag("submitting") ? "Envoi…" : "Soumettre"}
            </button>
            <button type="button" className="ghost" onClick={reset}>Réinitialiser</button>
            <span className="chip chip--renders" title="rendus de cette barre">↻ {renders}</span>
        </div>
    );
}
