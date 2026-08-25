import type { FormStatus } from "./FormView";

/**
 * Les flags d'un formulaire — **les mêmes mots que ceux d'un champ**.
 *
 * Une seule nuance, et elle est structurelle : au champ, `error` est ce qu'on
 * *affiche*, et il reste éteint tant qu'on n'a pas touché (arbitrage 24). Au
 * formulaire, il n'y a rien à afficher : `error` y est ce qui est *vrai*. Un
 * formulaire prérempli et faux ne part pas, même si aucun champ ne s'allume.
 */

/** Groupe exclusif — le verdict : le formulaire part, ou pas. */
export type FormValidityFlag = "valid" | "error";

/** Groupe exclusif — où en est l'envoi. C'est `FormStatus`. */
export type FormSubmissionFlag = FormStatus;

/**
 * Flags cumulés :
 *
 * - `loading` — un travail asynchrone est en vol quelque part ;
 * - `touched` — au moins un champ a été touché.
 */
export type FormMarkerFlag = "loading" | "touched";

/**
 * Le vocabulaire d'un formulaire est **clos**, contrairement à celui d'un champ.
 *
 * Les flags de l'application sont posés par un behavior, donc sur un champ. Rien
 * ne les remonte ici, et un type ouvert inviterait à écrire
 * `form.hasFlag("skeleton")` — qui répondrait `false` en silence. Pour lire un
 * flag applicatif, on lit le champ qui le porte.
 */
export type FormFlag = FormValidityFlag | FormSubmissionFlag | FormMarkerFlag;
