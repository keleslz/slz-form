import type { BehaviorState } from "../state";
import type { AnyFieldView } from "../field/FieldView";
import type { BehaviorContext } from "./BehaviorContext";

/**
 * What a hook may return:
 *   - a `BehaviorState` → replaces this behavior's slice
 *   - a promise of one   → applied on resolution, dropped if the field unmounted
 *   - nothing            → "I don't weigh in", the previous slice is kept
 */
export type BehaviorResult = BehaviorState | Promise<BehaviorState | void> | void;

/**
 * Orchestrates the reactions of one field (invariant 14). It never decides
 * validity — that is the Validator's job (invariant 13).
 *
 * A Behavior is stateless with respect to the field: it *returns* its slice and
 * the FieldController stores it. An instance may carry configuration (a URL, a
 * debounce), never field state — otherwise sharing one instance across two
 * fields would leak state between them.
 */
/**
 * Ce qui, chez un champ observé, réveille l'observateur.
 *
 * `value` seule est le défaut historique : sans ça, revalider ou toucher un
 * champ rejouait les lookups qui l'observent, jusqu'à relancer un appel réseau
 * pendant la soumission (arbitrage 18).
 *
 * `validity` et `activity` s'obtiennent en le demandant explicitement — c'est ce
 * qui rend possible « verrouiller B tant que A n'est pas valide ».
 */
export type WatchTrigger = "value" | "validity" | "activity";

/**
 * Une dépendance déclarée : un nom seul (déclenché sur la valeur), ou un nom
 * accompagné des déclencheurs voulus.
 */
export type WatchTarget = string | { readonly field: string; readonly on: readonly WatchTrigger[] };

export const DEFAULT_TRIGGERS: readonly WatchTrigger[] = ["value"];

/** Le nom observé, quelle que soit la forme déclarée. */
export function watchedName(target: WatchTarget): string {
    return typeof target === "string" ? target : target.field;
}

/** Les déclencheurs demandés — `["value"]` quand rien n'est précisé. */
export function watchedTriggers(target: WatchTarget): readonly WatchTrigger[] {
    return typeof target === "string" ? DEFAULT_TRIGGERS : target.on;
}

/** Ce qui a bougé chez un champ, par axe. */
export interface FieldChanges {
    readonly value: boolean;
    readonly validity: boolean;
    readonly activity: boolean;
}

export interface IBehavior<T = string, M = never> {
    /**
     * Fields this behavior reacts to. Nothing else is readable through
     * `ctx.watched()` (invariants 7, 23).
     */
    readonly watch?: readonly WatchTarget[];

    onMount?(ctx: BehaviorContext<T, M>): BehaviorResult;
    onChange?(ctx: BehaviorContext<T, M>, value: T | undefined): BehaviorResult;
    onFocus?(ctx: BehaviorContext<T, M>): BehaviorResult;
    onBlur?(ctx: BehaviorContext<T, M>): BehaviorResult;
    onSubmit?(ctx: BehaviorContext<T, M>): BehaviorResult;

    /** Fired when a field listed in `watch` changed. */
    onDependencyChanged?(ctx: BehaviorContext<T, M>, dependency: AnyFieldView): BehaviorResult;

    onUnmount?(ctx: BehaviorContext<T, M>): void;
}

/** Every hook the controller can dispatch without a payload. */
export type BehaviorHook = "onMount" | "onFocus" | "onBlur" | "onSubmit";
