export type LifecycleStatus = "idle" | "mounted" | "unmounted";

/**
 * Mount guard shared by FormController and FieldController (composition over
 * duplication — invariant 25).
 *
 * Three states rather than a single boolean, so "never mounted" and "was
 * mounted, now gone" stay distinguishable — `isMounted` / `isUnmounted` are
 * derived from it instead of being two independent booleans that can drift.
 */
export class Lifecycle {
    private state: LifecycleStatus = "idle";

    /** Returns `true` when the transition actually happened (idempotent otherwise). */
    mount(): boolean {
        if (this.state === "mounted") {
            return false;
        }
        this.state = "mounted";
        return true;
    }

    /** Returns `true` when the transition actually happened (idempotent otherwise). */
    unmount(): boolean {
        if (this.state !== "mounted") {
            return false;
        }
        this.state = "unmounted";
        return true;
    }

    /** Runs `mutate` only while mounted. Returns whether it ran. */
    update(mutate: () => void): boolean {
        if (this.state !== "mounted") {
            return false;
        }
        mutate();
        return true;
    }

    get status(): LifecycleStatus {
        return this.state;
    }

    get isMounted(): boolean {
        return this.state === "mounted";
    }

    get isUnmounted(): boolean {
        return this.state === "unmounted";
    }
}
