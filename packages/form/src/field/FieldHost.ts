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
     * @param valueChanged  seule une vraie modification de valeur propage aux
     *                      champs observateurs. Un changement de validité, de
     *                      `touched` ou de `submitting` met à jour le formulaire
     *                      sans rejouer les dépendances.
     */
    notifyFieldChanged(name: string, valueChanged: boolean): void;
}
