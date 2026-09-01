import type { FieldChanges } from "../behavior/IBehavior";
import type { EngineError } from "../error/EngineError";
import type { FormView } from "../form/FormView";

/**
 * The narrow slice of the Form a Field is allowed to see.
 *
 * The Field depends on this contract, not on `FormController` — the Form
 * orchestrates the Fields, never the other way round, and the dependency stays
 * one-directional.
 */
export interface FieldHost {
    formView(): FormView;
    /**
     * @param changes  ce qui a bougé, par axe. Un observateur n'est réveillé que
     *                 sur les axes qu'il a déclarés — `value` par défaut, ce qui
     *                 évite qu'une revalidation rejoue les lookups qui
     *                 l'observent (arbitrage 18).
     */
    notifyFieldChanged(name: string, changes: FieldChanges): void;
    /**
     * Route une erreur du moteur vers la surface portée par le formulaire.
     *
     * Le champ n'a personne à qui remonter une erreur asynchrone — la promesse
     * qui la porte n'est attendue par personne. Il la remet donc au formulaire,
     * qui la bufferise et notifie ses abonnés (invariant 38). Le moteur ne
     * loggue jamais.
     */
    reportEngineError(error: EngineError): void;
}
