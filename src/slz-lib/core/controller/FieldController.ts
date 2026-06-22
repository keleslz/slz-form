import type { IValidator, ValidatorState } from "../validator";
import type { BehaviorContext, IBehavior } from "../behavior";
import type { UIFlag } from "../util";

export interface FieldSnapshot {
    value: string;
    flags: UIFlag[];
    touched: boolean;
    submitting: boolean;
    validatorStatus?: ValidatorState["status"];
    errors: string[];
    name: string;
}

export interface FieldControllerOptions {
    name: string;
    initialValue?: string;
    required?: boolean;
}

type Listener = () => void;
type SyncHook = "onMount" | "onChange" | "onBlur" | "onSubmit" | "onValidationResolved";

/**
 * Framework-agnostic orchestrator
 * Knows nothing about React, Redux, MUI, or the form-level state.
 */
export class FieldController {
    private readonly validator?: IValidator<string>;
    private readonly behaviors: IBehavior[];
    private readonly name: string;
    private value: string;
    private touched = false;
    private submitting = false;
    private required?: boolean;
    private mounted = false;

    private readonly flagsByBehavior = new Map<IBehavior, UIFlag[]>();
    private readonly listeners = new Set<Listener>();
    private snapshot!: FieldSnapshot;
    private abort = new AbortController();
    private unsubscribeValidator?: () => void;

    constructor({ validator, behaviors, options }: {
        validator?: IValidator<string>,
        behaviors: IBehavior[],
        options?: FieldControllerOptions,
    }
    ) {
        this.validator = validator;
        this.behaviors = behaviors;
        this.name = options?.name ?? "";
        this.value = options?.initialValue ?? "";
        this.required = options?.required;
        for (const b of behaviors) this.flagsByBehavior.set(b, []);
        this.rebuildSnapshot();
    }

    // ── lifecycle ──────────────────────────────────────────────────────────
    mount(): void {
        if (this.mounted) return;
        this.mounted = true;
        this.abort = new AbortController();
        this.unsubscribeValidator = this.validator?.subscribe(() => this.run("onValidationResolved"))
        this.run("onMount");
    }

    unmount(): void {
        if (!this.mounted) return;
        this.mounted = false;
        this.abort.abort();
        this.unsubscribeValidator?.();
        this.unsubscribeValidator = undefined;
        for (const b of this.behaviors) b.onUnmount?.(this.buildContext(b));
    }

    // ── events ─────────────────────────────────────────────────────────────
    change(next: string): void {
        if (this.value === next) return;
        this.value = next;
        this.run("onChange", next);
        // Fire-and-forget: validator notifications drive `onValidationResolved`.
        void this.validator?.setOptions({ required: this.required }).handleAsync(next);
    }

    blur(): void {
        if (this.touched) return;
        this.touched = true;
        this.run("onBlur");
    }

    submit(): void {
        this.run("onSubmit");
    }

    // ── adapter-pushed external state ──────────────────────────────────────
    setSubmitting(value: boolean): void {
        if (this.submitting === value) {
            return;
        }
        this.submitting = value;
        this.rebuildSnapshot();
        this.emit();
    }

    setRequired(required: boolean | undefined): void {
        if (this.required === required) {
            return;
        }
        this.required = required;
        this.rebuildSnapshot();
        this.emit();
    }

    // ── observable surface ─────────────────────────────────────────────────
    getSnapshot(): FieldSnapshot {
        return this.snapshot;
    }

    subscribe(cb: Listener): () => void {
        this.listeners.add(cb);
        return () => {
            this.listeners.delete(cb);
        };
    }

    // ── orchestration ──────────────────────────────────────────────────────
    private run(hook: SyncHook, changedValue?: string): void {
        // Capture the signal *once* per cycle: any async result that resolves
        // after a re-mount must be ignored, even if a new (non-aborted) signal
        // has replaced this one in the meantime (StrictMode mount/unmount/mount).
        const signalAtInvoke = this.abort.signal;
        for (const b of this.behaviors) {
            const ctx = this.buildContext(b);
            const result = this.invoke(b, hook, ctx, changedValue);
            this.applyResult(b, result, signalAtInvoke);
        }
        this.rebuildSnapshot();
        this.emit();
    }

    private invoke(
        b: IBehavior,
        hook: SyncHook,
        ctx: BehaviorContext,
        changedValue?: string,
    ): UIFlag[] | Promise<UIFlag[]> | void {
        switch (hook) {
            case "onMount": return b.onMount?.(ctx);
            case "onChange": return b.onChange?.(changedValue ?? this.value, ctx);
            case "onBlur": return b.onBlur?.(ctx);
            case "onSubmit": return b.onSubmit?.(ctx);
            case "onValidationResolved": return b.onValidationResolved?.(ctx);
        }
    }

    private applyResult(
        b: IBehavior,
        r: UIFlag[] | Promise<UIFlag[]> | void,
        signalAtInvoke?: AbortSignal,
    ): void {
        if (Array.isArray(r)) {
            this.flagsByBehavior.set(b, r);
            return;
        }
        if (r && typeof (r as Promise<unknown>).then === "function") {
            (r as Promise<UIFlag[]>).then((flags) => {
                // Compare against the signal captured when the hook was invoked,
                // not `this.abort.signal` — that one may already point to a fresh
                // (non-aborted) mount cycle, and we'd wrongly overwrite its flags.
                if (signalAtInvoke?.aborted || !Array.isArray(flags)) return;
                this.flagsByBehavior.set(b, flags);
                this.rebuildSnapshot();
                this.emit();
            });
        }
    }

    private buildContext(b: IBehavior): BehaviorContext {
        // Snapshot the signal at context-creation time: closures that fire later
        // (e.g. pushFlags called after an awaited fetch) must be tied to the
        // mount cycle that built the context, not to the controller's current
        // signal (which may have been replaced by a fresh mount).
        const signal = this.abort.signal;
        return {
            name: this.snapshot.value, // for debugging
            signal,
            validator: this.validator,
            touched: this.touched,
            submitting: this.submitting,
            getName: () => this.name,
            getValue: () => this.value,
            setValue: (v) => this.change(v),
            pushFlags: (flags) => {
                if (signal.aborted) return;
                this.flagsByBehavior.set(b, flags);
                this.rebuildSnapshot();
                this.emit();
            },
        };
    }

    private rebuildSnapshot(): void {
        const state = this.validator?.getState();
        const flags = Array.from(new Set([...this.flagsByBehavior.values()].flat()));
        this.snapshot = {
            name: this.name,
            value: this.value,
            flags,
            touched: this.touched,
            submitting: this.submitting,
            validatorStatus: state?.status,
            errors: state?.status === "error" ? state.errors : [],
        };
    }

    private emit(): void {
        for (const cb of this.listeners) cb();
    }
}
