/**
 * Une erreur du moteur, routée vers le formulaire au lieu d'être journalisée.
 *
 * Le moteur ne loggue jamais (invariant 38) : quand un hook de behavior lève,
 * qu'une règle de validation casse, ou qu'une garde du moteur est violée, il
 * n'a personne à qui remonter l'erreur — la promesse qui la porte n'est
 * attendue par personne. Plutôt que de l'écrire dans la console, il la **route**
 * vers une surface portée par le `FormController`, que le consommateur lit
 * (`form.engineErrors`) ou écoute (`form.onEngineError`).
 *
 * Cette surface est **hors du snapshot** et n'existe qu'au formulaire, jamais
 * sur `FieldView` : la vue lue par behaviors et validators n'ouvre aucune
 * souscription globale (invariant 10).
 */
export interface EngineError {
    /** D'où vient l'erreur : un hook de behavior, ou une règle de validation. */
    readonly scope: "behavior" | "validator";
    /**
     * Sa nature :
     *
     * - `hook-error` : le code **consommateur** a levé — un réseau tombé, une
     *   réponse illisible, un bug applicatif ;
     * - `guard-violation` : le **moteur** a levé, parce qu'un contrat a été
     *   enfreint — un flag réservé posé par `mark`, un champ lu sans être
     *   déclaré dans `watch`.
     *
     * Classée par `instanceof EngineGuardError` au site du catch : le
     * consommateur distingue un bug de sa logique d'un mauvais usage de l'API.
     */
    readonly kind: "hook-error" | "guard-violation";
    /** Le champ où l'erreur s'est produite. */
    readonly field: string;
    /** Le nom de la règle ou du membre fautif, côté validator uniquement. */
    readonly rule?: string;
    /** L'objet levé, tel quel — le moteur ne l'interprète pas. */
    readonly error: unknown;
    /** Horodatage (`Date.now()`) de la capture. */
    readonly at: number;
}

/**
 * Une garde du moteur enfreinte : un flag réservé posé par un behavior, un champ
 * lu sans avoir été déclaré dans `watch`.
 *
 * Levée typée, et non un `Error` nu, pour que le site du catch classe l'erreur
 * en `guard-violation` par un simple `instanceof` — sans lire de message ni
 * deviner. Ce qui distingue un mauvais usage de l'API (guard) d'une panne du
 * code consommateur (hook), là où les deux transitent par le même canal.
 */
export class EngineGuardError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EngineGuardError";
    }
}
