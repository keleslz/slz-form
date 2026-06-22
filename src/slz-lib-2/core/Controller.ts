import { DefaultBehavior, type BehaviorContext, type BehaviorResult, type IBehavior, type SyncHook } from "./behavior";
import type { StateFlags } from "./state/StateFlag";
import type { StateSnapshot } from "./state/StateSnapshot";
import { Field } from "./ui/Field";
import type { FieldParams } from "./ui/FieldParams";
import type { FieldValue } from "./ui/FieldValue";
import { Form } from "./ui/Form";
import type { IValidator } from "./validator/IValidator";

type Listener = () => void;

/**
 * Framework-agnostic orchestrator. Drives the field lifecycle (mount/change/
 * blur/focus/unmount), runs the behavior hooks, and bridges the field state to
 * the outside world via `subscribe`/`getSnapshot` (React) and `dispatch` (Redux).
 * It knows nothing about React, Redux or MUI — those are injected.
 */
export class Controller {
    private mounted = false;
    public readonly form: Form
    public readonly field: Field
    private readonly dispatch: (field: Field) => void
    private unsubscribeValidator?: () => void;

    constructor(params: {
        form?: Form;
        field: FieldParams,
        behaviors?: IBehavior[];
        validator?: IValidator,
        dispatch: (field: Field) => void
    }) {
        this.form = params.form ?? new Form()
        this.field = new Field(params.field)

        const behaviors = params.behaviors && params.behaviors.length > 0
            ? params.behaviors
            : [new DefaultBehavior()];
        for (const behavior of behaviors) {
            this.field.addBehavior(behavior);
        }

        if (params.validator) {
            this.field.addValidator(params.validator)
        }

        this.dispatch = params.dispatch
        // Mirror every field change to Redux.
        this.field.subscribe(() => this.dispatch(this.field));
    }

    // ── observable surface (React via useSyncExternalStore) ──────────────
    public subscribe = (listener: Listener): (() => void) => {
        return this.field.subscribe(listener);
    }

    public getSnapshot = (): StateSnapshot => {
        return this.field.snapshot;
    }

    // ── lifecycle ────────────────────────────────────────────────────────
    public mount(value?: FieldValue) {
        if (this.mounted) {
            return;
        }
        this.mounted = true;
        if (value !== undefined) {
            this.field.setValue(value);
        }
        // Async validators notify here; re-run the reflecting hook on resolution.
        this.unsubscribeValidator = this.field.validator?.subscribe(() => this.run("onChange"));
        this.run("onMount");
    }

    public change = (value?: FieldValue) => {
        if (this.field.value === value) {
            return;
        }
        this.field.setValue(value);
        this.run("onChange", value);
        // Fire-and-forget: validator notifications drive the recompute above.
        void this.field.validator?.setOptions({ required: this.field.required }).handleAsync(value);
    }

    public blur = () => {
        this.field.touch();
        this.field.blur();
        this.run("onBlur");
    }

    public focus = () => {
        this.field.focus();
        this.run("onFocus");
    }

    public unmount() {
        if (!this.mounted) {
            return;
        }
        this.mounted = false;
        this.unsubscribeValidator?.();
        this.unsubscribeValidator = undefined;
        for (const behavior of this.field.getBehaviors()) {
            behavior.onUnmount?.(this.field.buildContext(behavior))
        }
    }

    // ── orchestration ────────────────────────────────────────────────────
    private run(hook: SyncHook, value?: FieldValue) {
        for (const behavior of this.field.getBehaviors()) {
            const ctx = this.field.buildContext(behavior);
            const result = this.invoke(behavior, hook, ctx, value);
            this.applyResult(behavior, result);
        }
        this.field.rebuildSnapshot();
        this.field.emit();
    }

    private invoke(
        behavior: IBehavior,
        hook: SyncHook,
        ctx: BehaviorContext,
        value?: FieldValue,
    ): BehaviorResult | void {
        switch (hook) {
            case "onMount": return behavior.onMount?.(ctx);
            case "onChange": return behavior.onChange?.(ctx, value ?? this.field.value);
            case "onFocus": return behavior.onFocus?.(ctx);
            case "onBlur": return behavior.onBlur?.(ctx);
        }
    }

    private applyResult(behavior: IBehavior, result: BehaviorResult | void): void {
        if (Array.isArray(result)) {
            this.field.setFlags(behavior, result);
            return;
        }
        if (result && typeof (result as Promise<StateFlags>).then === "function") {
            (result as Promise<StateFlags>).then((flags) => {
                if (!Array.isArray(flags)) return;
                this.field.setFlags(behavior, flags);
                this.field.emit();
            });
        }
    }
}
