import { BehaviorState } from "../state";

/**
 * L'état que porte un behavior pendant son travail asynchrone.
 *
 * Plutôt qu'un booléen `lock`, le consommateur compose l'état attendu : la
 * tranche d'un behavior est déjà un objet valeur à API fluide, autant s'en
 * servir. Cela couvre les cas qu'un booléen ne sait pas dire — masquer le champ
 * pendant le chargement, ou le laisser entièrement disponible.
 *
 * ```ts
 * pending: (state) => state.loading().lock()   // défaut : on remplit le champ
 * pending: (state) => state.loading()          // champ de recherche : l'utilisateur continue de taper
 * pending: (state) => state.loading().hide()   // on masque tant qu'il n'y a rien à montrer
 * ```
 */
export type PendingState = (state: BehaviorState) => BehaviorState;

/** Le champ est occupé et verrouillé : ce qu'on veut quand on va écrire dedans. */
export const lockedWhilePending: PendingState = (state) => state.loading().lock();

/** Le champ est occupé mais reste utilisable : ce qu'on veut pour une recherche. */
export const openWhilePending: PendingState = (state) => state.loading();
