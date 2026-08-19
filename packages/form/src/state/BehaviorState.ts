import type { ActivityFlag, AvailabilityFlag, UiFlag } from "./UiFlag";

/**
 * The slice of UI state a **single** Behavior owns.
 *
 * Immutable value object: every mutator returns a new instance. A Behavior can
 * therefore never leak state between two Fields, and the FieldController stays
 * the single source of truth (invariant 2). A Behavior instance carries
 * *configuration* (a URL, a debounce); never field state.
 *
 * A Behavior never carries the validity axis — that belongs to the Validator
 * (invariant 13).
 */
export class BehaviorState {
    static readonly neutral: BehaviorState = new BehaviorState("idle", []);

    readonly activity: ActivityFlag;
    readonly availability: readonly AvailabilityFlag[];

    constructor(activity: ActivityFlag, availability: readonly AvailabilityFlag[]) {
        this.activity = activity;
        this.availability = Object.freeze([...new Set(availability)].sort());
    }

    // ── activity axis (exclusive: setting one replaces the other) ─────────
    loading(): BehaviorState {
        return this.activity === "loading" ? this : new BehaviorState("loading", this.availability);
    }

    idle(): BehaviorState {
        return this.activity === "idle" ? this : new BehaviorState("idle", this.availability);
    }

    // ── availability axis (cumulative: added / removed independently) ─────
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

    has(flag: UiFlag): boolean {
        return this.activity === flag || this.availability.includes(flag as AvailabilityFlag);
    }

    equals(other: BehaviorState): boolean {
        return this.activity === other.activity
            && this.availability.length === other.availability.length
            && this.availability.every((flag, i) => flag === other.availability[i]);
    }

    private with(flag: AvailabilityFlag): BehaviorState {
        if (this.availability.includes(flag)) {
            return this;
        }
        return new BehaviorState(this.activity, [...this.availability, flag]);
    }

    private without(flag: AvailabilityFlag): BehaviorState {
        if (!this.availability.includes(flag)) {
            return this;
        }
        return new BehaviorState(this.activity, this.availability.filter((f) => f !== flag));
    }
}
