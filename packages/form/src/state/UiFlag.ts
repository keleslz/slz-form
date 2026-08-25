/**
 * Les flags disent **dans quel état** est un champ. Les données — valeur,
 * options, messages — disent ce qu'il contient, et ne sont pas des flags.
 *
 * Deux natures, et une seule règle par nature :
 *
 * - **exclusif** : une valeur à la fois, poser l'une retire l'autre ;
 * - **cumulé** : un ensemble, l'union fait foi (un seul `lock()` verrouille) et
 *   l'absence vaut défaut — c'est ce qui donne un sens à « cesser d'émettre ».
 *
 * Une union plate produirait `pristine` + `error`, qui n'est pas un état : les
 * groupes exclusifs existent pour ça, et ce sont les seuls à vocabulaire fermé.
 */

/** Groupe exclusif — la validité **affichée**. Produite par le Validator seul. */
export type ValidityFlag = "pristine" | "valid" | "error";

/** Groupe exclusif — `loading` dès qu'un behavior ou le validator travaille. */
export type ActivityFlag = "idle" | "loading";

/**
 * Les flags cumulés du moteur. Ils vont et viennent indépendamment :
 *
 * - `locked` grise le champ et le sort de la saisie ;
 * - `readonly` le laisse lisible et sélectionnable, non modifiable ;
 * - `invisible` ne le rend pas ;
 * - `required` le déclare obligatoire ;
 * - `touched` / `focused` disent l'interaction ;
 * - `mounted` dit qu'il fait partie du formulaire qu'on remplit ;
 * - `submitting` dit que le formulaire est en train de partir.
 */
export type MarkerFlag =
    | "locked"
    | "readonly"
    | "invisible"
    | "required"
    | "touched"
    | "focused"
    | "mounted"
    | "submitting";

/** Le vocabulaire du moteur, à plat : ce que `hasFlag(...)` connaît d'avance. */
export type UiFlag = ValidityFlag | ActivityFlag | MarkerFlag;

/**
 * Le vocabulaire ouvert : celui du moteur, **plus les flags de l'application**.
 *
 * Ouvrir n'est sans risque que du côté cumulé, où deux behaviors s'additionnent
 * sans pouvoir se contredire. Les groupes exclusifs, eux, restent fermés.
 *
 * `(string & {})` — et non `string` — pour que les flags connus restent proposés
 * à l'autocomplétion au lieu d'être absorbés par le type large.
 */
export type AnyUiFlag = UiFlag | (string & {});

export const VALIDITY_FLAGS: readonly ValidityFlag[] = ["pristine", "valid", "error"];
export const ACTIVITY_FLAGS: readonly ActivityFlag[] = ["idle", "loading"];
export const MARKER_FLAGS: readonly MarkerFlag[] = [
    "locked",
    "readonly",
    "invisible",
    "required",
    "touched",
    "focused",
    "mounted",
    "submitting",
];

/**
 * Ce qu'un Behavior a le droit d'émettre : la disponibilité, et **les flags de
 * l'application**.
 *
 * Le reste appartient à un autre émetteur — la validité au Validator, l'activité
 * au couple `loading()`/`idle()`, l'interaction et la présence au Controller.
 */
export type BehaviorFlag = "locked" | "readonly" | "invisible" | (string & {});

/**
 * Les mots que le moteur se réserve.
 *
 * Sans cette garde, `mark("error")` publierait `pristine` **et** `error` — l'état
 * impossible que le découpage en groupes exclusifs existe pour écarter — et
 * `mark("loading")` allumerait une activité que rien ne pourrait éteindre, puisque
 * l'union ne se soustrait pas (invariant 33).
 */
export const RESERVED_FLAGS: readonly UiFlag[] = [
    ...VALIDITY_FLAGS,
    ...ACTIVITY_FLAGS,
    "required",
    "touched",
    "focused",
    "mounted",
    "submitting",
];

/** Vrai si ce mot appartient au moteur et n'est pas à prendre. */
export function isReservedFlag(flag: AnyUiFlag): boolean {
    return RESERVED_FLAGS.some((reserved) => reserved === flag);
}
