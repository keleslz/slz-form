import type { FieldChanges } from "../behavior/IBehavior";
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
}
