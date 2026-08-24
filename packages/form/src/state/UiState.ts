import type { BehaviorState } from "./BehaviorState";
import type { ActivityFlag, AnyUiFlag, ValidityFlag } from "./UiFlag";

/**
 * The merged UI state of one Field — what the consumer reads.
 *
 * Merge rules:
 *   validity ← the Validator alone (invariant 13)
 *   activity ← `loading` if *any* behavior, or the validator, is in flight
 *   markers  ← union of every behavior's flags, plus the controller's own
 *              (a single `lock()` locks)
 *
 * Removing a flag is therefore well defined: in an exclusive group you replace,
 * among the markers you stop emitting.
 */
export class UiState {
    readonly validity: ValidityFlag;
    readonly activity: ActivityFlag;
    readonly markers: readonly AnyUiFlag[];

    constructor(validity: ValidityFlag, activity: ActivityFlag, markers: readonly AnyUiFlag[]) {
        this.validity = validity;
        this.activity = activity;
        this.markers = Object.freeze([...new Set(markers)].sort());
    }

    /**
     * @param validating  the validator is in flight — counts toward `loading`
     * @param extra       markers the controller itself contributes (`touched`,
     *                    `locked` while submitting, …)
     */
    static merge(
        validity: ValidityFlag,
        states: Iterable<BehaviorState>,
        validating = false,
        extra: readonly AnyUiFlag[] = [],
    ): UiState {
        let activity: ActivityFlag = validating ? "loading" : "idle";
        const markers: AnyUiFlag[] = [...extra];

        for (const state of states) {
            if (state.activity === "loading") {
                activity = "loading";
            }
            markers.push(...state.markers);
        }

        return new UiState(validity, activity, markers);
    }

    /** ET — `true` si le champ porte **tous** les flags donnés. */
    hasFlag(...flags: AnyUiFlag[]): boolean {
        return flags.every((flag) => this.holds(flag));
    }

    /** OU — `true` si le champ porte **au moins un** des flags donnés. */
    hasAny(...flags: AnyUiFlag[]): boolean {
        return flags.some((flag) => this.holds(flag));
    }

    /** Projection à plat — pour le débogage et le rendu de l'état brut. */
    get flags(): readonly AnyUiFlag[] {
        return [this.validity, this.activity, ...this.markers];
    }

    equals(other: UiState): boolean {
        return this.validity === other.validity
            && this.activity === other.activity
            && this.markers.length === other.markers.length
            && this.markers.every((flag, i) => flag === other.markers[i]);
    }

    private holds(flag: AnyUiFlag): boolean {
        return this.validity === flag
            || this.activity === flag
            || this.markers.includes(flag);
    }
}
