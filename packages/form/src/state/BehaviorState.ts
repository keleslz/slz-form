import type { ActivityFlag, AnyUiFlag } from "./UiFlag";

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

    constructor(activity: ActivityFlag, markers: readonly AnyUiFlag[]) {
        this.activity = activity;
        this.markers = Object.freeze([...new Set(markers)].sort());
    }

    // ── exclusive group (setting one replaces the other) ──────────────────
    loading(): BehaviorState {
        return this.activity === "loading" ? this : new BehaviorState("loading", this.markers);
    }

    idle(): BehaviorState {
        return this.activity === "idle" ? this : new BehaviorState("idle", this.markers);
    }

    // ── cumulative markers (added / removed independently) ────────────────
    /**
     * Pose un flag — un des flags du moteur, ou **un des tiens**.
     *
     * C'est ce qui rend l'inconnu exprimable : un behavior peut publier
     * `mark("skeleton")` et la vue le lire par `hasFlag("skeleton")`, sans que
     * le moteur ait à connaître le mot.
     */
    mark(flag: AnyUiFlag): BehaviorState {
        return this.with(flag);
    }

    /** Cesse d'émettre un flag — l'absence vaut défaut. */
    unmark(flag: AnyUiFlag): BehaviorState {
        return this.without(flag);
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
        return BehaviorState.neutral;
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
        return new BehaviorState(this.activity, [...this.markers, flag]);
    }

    private without(flag: AnyUiFlag): BehaviorState {
        if (!this.markers.includes(flag)) {
            return this;
        }
        return new BehaviorState(this.activity, this.markers.filter((f) => f !== flag));
    }
}
