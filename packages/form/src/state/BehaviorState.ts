import { EngineGuardError } from "../error/EngineError";
import { isReservedFlag, type ActivityFlag, type AnyUiFlag, type BehaviorFlag } from "./UiFlag";

/**
 * The slice of UI state a **single** Behavior owns.
 *
 * Immutable value object: every mutator returns a new instance. A Behavior can
 * therefore never leak state between two Fields, and the FieldController stays
 * the single source of truth (invariant 2). A Behavior instance carries
 * *configuration* (a URL, a debounce); never field state.
 *
 * A Behavior never carries the validity group — that belongs to the Validator
 * (invariant 13).
 */
export class BehaviorState {
    static readonly neutral: BehaviorState = new BehaviorState("idle", []);

    readonly activity: ActivityFlag;
    readonly markers: readonly AnyUiFlag[];
    /**
     * L'auteur de cette tranche a **parlé de l'activité** — il a appelé
     * `loading()` ou `idle()`.
     *
     * `ctx.state` rend la tranche fusionnée du behavior : un hook qui ajoute un
     * marqueur pendant un appel écrit `loading` sans l'avoir demandé. Sans ce
     * témoin, le moteur ne peut pas distinguer une intention d'un écho — et il
     * l'a payé en tours de revue.
     */
    readonly activityStated: boolean;

    /**
     * Le constructeur garde la même règle que `mark` — sinon la garde ne
     * protégerait que la porte : un behavior retourne une `BehaviorState`, et
     * rien ne l'oblige à passer par les mutateurs. `new BehaviorState("idle",
     * ["error"])` publiait `pristine` **et** `error`, et un `loading` marqueur
     * que la lecture confondait avec l'activité.
     */
    constructor(activity: ActivityFlag, markers: readonly AnyUiFlag[], activityStated = false) {
        this.activity = activity;
        this.markers = Object.freeze(
            [...new Set(markers.map((flag) => refuseReserved(flag, "new BehaviorState")))].sort(),
        );
        this.activityStated = activityStated;
    }

    // ── exclusive group (setting one replaces the other) ──────────────────
    loading(): BehaviorState {
        return new BehaviorState("loading", this.markers, true);
    }

    idle(): BehaviorState {
        return new BehaviorState("idle", this.markers, true);
    }

    // ── cumulative markers (added / removed independently) ────────────────
    /**
     * Pose un flag de disponibilité, ou **un des tiens**.
     *
     * C'est ce qui rend l'inconnu exprimable : un behavior publie
     * `mark("skeleton")`, la vue lit `hasFlag("skeleton")`, et le moteur n'a
     * jamais eu à connaître le mot.
     *
     * Les mots du moteur sont refusés (`RESERVED_FLAGS`). Poser `error` à côté
     * de `pristine` publierait un état qui n'existe pas, et poser `loading` ici
     * allumerait une activité que rien ne pourrait éteindre — l'union des flags
     * cumulés ne se soustrait pas. Les groupes exclusifs restent clos
     * (invariant 33).
     */
    mark(flag: BehaviorFlag): BehaviorState {
        return this.with(refuseReserved(flag, "mark"));
    }

    /** Cesse d'émettre un flag — l'absence vaut défaut. */
    unmark(flag: BehaviorFlag): BehaviorState {
        return this.without(refuseReserved(flag, "unmark"));
    }

    lock(): BehaviorState {
        return this.with("locked");
    }

    unlock(): BehaviorState {
        return this.without("locked");
    }

    /** Lisible mais non modifiable — n'implique pas `locked`. */
    readOnly(): BehaviorState {
        return this.with("readonly");
    }

    writable(): BehaviorState {
        return this.without("readonly");
    }

    hide(): BehaviorState {
        return this.with("invisible");
    }

    show(): BehaviorState {
        return this.without("invisible");
    }

    /** Drops every flag this behavior contributes — the field reverts to what the others say. */
    clear(): BehaviorState {
        return new BehaviorState("idle", [], true);
    }

    has(flag: AnyUiFlag): boolean {
        return this.activity === flag || this.markers.includes(flag);
    }

    equals(other: BehaviorState): boolean {
        return this.activity === other.activity
            && this.markers.length === other.markers.length
            && this.markers.every((flag, i) => flag === other.markers[i]);
    }

    private with(flag: AnyUiFlag): BehaviorState {
        if (this.markers.includes(flag)) {
            return this;
        }
        return new BehaviorState(this.activity, [...this.markers, flag], this.activityStated);
    }

    private without(flag: AnyUiFlag): BehaviorState {
        if (!this.markers.includes(flag)) {
            return this;
        }
        return new BehaviorState(this.activity, this.markers.filter((f) => f !== flag), this.activityStated);
    }
}

/**
 * Un mot du moteur passé à `mark`/`unmark` est une erreur de conception du
 * behavior, pas une valeur à ignorer : la laisser passer publierait un état
 * impossible, la taire rendrait le behavior silencieusement inopérant.
 */
function refuseReserved(flag: BehaviorFlag, method: string): BehaviorFlag {
    if (isReservedFlag(flag)) {
        // Garde du moteur : erreur typée, pour que le site du catch la classe en
        // `guard-violation` sans lire le message.
        throw new EngineGuardError(
            `[slz] \`${method}("${String(flag)}")\` : "${String(flag)}" appartient au moteur. `
            + "Un behavior émet la disponibilité (`lock`, `readOnly`, `hide`) et ses propres flags.",
        );
    }
    return flag;
}
