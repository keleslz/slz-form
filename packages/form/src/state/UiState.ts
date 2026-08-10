import type { BehaviorState } from "./BehaviorState";
import type { ActivityFlag, AvailabilityFlag, UiFlag, ValidityFlag } from "./UiFlag";

/**
 * The merged UI state of one Field — what the consumer reads.
 *
 * Merge rules, one per axis:
 *   validity     ← the Validator alone (invariant 13)
 *   activity     ← `loading` if *any* behavior, or the validator, is in flight
 *   availability ← union of every behavior's flags (a single `lock()` locks)
 *
 * Removing a flag is therefore well defined: on an exclusive axis you replace,
 * on the cumulative axis you stop emitting.
 */
export class UiState {
    readonly validity: ValidityFlag;
    readonly activity: ActivityFlag;
    readonly availability: readonly AvailabilityFlag[];

    constructor(validity: ValidityFlag, activity: ActivityFlag, availability: readonly AvailabilityFlag[]) {
        this.validity = validity;
        this.activity = activity;
        this.availability = Object.freeze([...new Set(availability)].sort());
    }

    /**
     * @param validating  the validator is in flight — counts toward `loading`
     * @param extra       availability the controller itself contributes (e.g. `locked` while submitting)
     */
    static merge(
        validity: ValidityFlag,
        states: Iterable<BehaviorState>,
        validating = false,
        extra: readonly AvailabilityFlag[] = [],
    ): UiState {
        let activity: ActivityFlag = validating ? "loading" : "idle";
        const availability: AvailabilityFlag[] = [...extra];

        for (const state of states) {
            if (state.activity === "loading") {
                activity = "loading";
            }
            availability.push(...state.availability);
        }

        return new UiState(validity, activity, availability);
    }

    /** `true` if the field carries **at least one** of the given flags. */
    has(...flags: UiFlag[]): boolean {
        return flags.some((flag) => this.holds(flag));
    }

    /** `true` if the field carries **every** given flag. */
    hasEvery(...flags: UiFlag[]): boolean {
        return flags.every((flag) => this.holds(flag));
    }

    /** Flat projection — handy for debugging and for rendering the raw state. */
    get flags(): readonly UiFlag[] {
        return [this.validity, this.activity, ...this.availability];
    }

    equals(other: UiState): boolean {
        return this.validity === other.validity
            && this.activity === other.activity
            && this.availability.length === other.availability.length
            && this.availability.every((flag, i) => flag === other.availability[i]);
    }

    private holds(flag: UiFlag): boolean {
        return this.validity === flag
            || this.activity === flag
            || this.availability.includes(flag as AvailabilityFlag);
    }
}
