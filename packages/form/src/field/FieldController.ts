import type { BehaviorContext, BehaviorHook, BehaviorResult, IBehavior } from "../behavior";
import { Lifecycle } from "../lifecycle";
import { BehaviorState, UiState } from "../state";
import type { UiFlag, ValidityFlag } from "../state";
import { DefaultValidator, type IValidator, type ValidatorStatus } from "../validator";
import type { FormView } from "../form/FormView";
import type { FieldHost } from "./FieldHost";
import type { OptionValue } from "./Field";
import type { FieldOption } from "./FieldOption";
import { FieldSnapshot } from "./FieldSnapshot";
import type { AnyFieldView, FieldView } from "./FieldView";

type Listener = () => void;

export interface FieldParams<T = string, M = never> {
    name: string;
    required?: boolean;
    /** Overrides the validator's default "required" message. */
    requiredMessage?: string;
    initialValue?: T;
    validator?: IValidator<T>;
    behaviors?: readonly IBehavior<T, M>[];
    options?: readonly FieldOption<OptionValue<T>, M>[];
}

/** Props the consumer can push after creation. Identity (name, behaviors, validator) is fixed. */
export interface FieldUpdate<T = string, M = never> {
    required?: boolean;
    value?: T;
    options?: readonly FieldOption<OptionValue<T>, M>[];
}

/**
 * Owns one input: its value, its interactions, its behaviors' slices and its
 * validator. Source of truth for that field and for nothing else (invariants 2,
 * 5, 6) — it can read the form, never write to another field.
 *
 * Configuration is a single object; everything beyond `name` is optional
 * (invariant 17).
 */
export class FieldController<T = string, M = never> {
    readonly name: string;

    private readonly lifecycle = new Lifecycle();
    private readonly behaviors: readonly IBehavior<T, M>[];
    private readonly validator: IValidator<T>;
    private readonly statesByBehavior = new Map<IBehavior<T, M>, BehaviorState>();
    private readonly listeners = new Set<Listener>();

    private host: FieldHost | null = null;
    private required: boolean;
    private readonly requiredMessage?: string;
    private value: T | undefined;
    private options: readonly FieldOption<OptionValue<T>, M>[];
    private touched = false;
    private focused = false;
    private submitting = false;
    private validity: ValidityFlag = "pristine";
    private current: FieldSnapshot<T, M>;
    private abort = new AbortController();
    private unsubscribeValidator: (() => void) | null = null;

    constructor(params: FieldParams<T, M>) {
        this.name = params.name;
        this.behaviors = params.behaviors ?? [];
        // Always a validator: validity then has exactly one source, with no
        // "is there one?" branch anywhere (invariants 13, 16).
        this.validator = params.validator ?? new DefaultValidator<T>();
        this.required = params.required ?? false;
        this.requiredMessage = params.requiredMessage;
        this.value = params.initialValue;
        this.options = params.options ?? [];

        for (const behavior of this.behaviors) {
            this.statesByBehavior.set(behavior, BehaviorState.neutral);
        }

        this.current = this.buildSnapshot();
    }

    // ── wiring ───────────────────────────────────────────────────────────
    /** Called once by the FormController the field joins. */
    attach(host: FieldHost): void {
        if (this.host && this.host !== host) {
            throw new Error(`[slz] Field "${this.name}" is already attached to another form.`);
        }
        this.host = host;
    }

    /** Names this field reacts to — the FormController builds its graph from this. */
    dependencies(): readonly string[] {
        return [...new Set(this.behaviors.flatMap((behavior) => behavior.watch ?? []))];
    }

    // ── lifecycle ────────────────────────────────────────────────────────
    mount(): void {
        if (!this.lifecycle.mount()) {
            return;
        }
        this.abort = new AbortController();
        this.unsubscribeValidator = this.validator.subscribe(() => this.commit());
        this.run("onMount");
    }

    update(params: FieldUpdate<T, M>): void {
        this.lifecycle.update(() => {
            if (params.required !== undefined && params.required !== this.required) {
                this.required = params.required;
                void this.revalidate();
            }
            if (params.options !== undefined) {
                this.options = params.options;
            }
            if (params.value !== undefined) {
                this.assign(params.value);
            }
            this.commit();
        });
    }

    unmount(): void {
        if (!this.lifecycle.unmount()) {
            return;
        }
        this.abort.abort();
        this.unsubscribeValidator?.();
        this.unsubscribeValidator = null;

        for (const behavior of this.behaviors) {
            behavior.onUnmount?.(this.buildContext(behavior, this.abort.signal));
        }
        this.commit();
    }

    get isMounted(): boolean {
        return this.lifecycle.isMounted;
    }

    get isUnmounted(): boolean {
        return this.lifecycle.isUnmounted;
    }

    /**
     * Un travail asynchrone est en cours : un behavior en vol, ou le validator.
     *
     * C'est le signal sur lequel le FormController s'appuie pour ne pas
     * soumettre un formulaire dont toutes les valeurs ne sont pas encore posées.
     */
    get isBusy(): boolean {
        return this.current.ui.activity === "loading";
    }

    /**
     * Revalide tout de suite, sans attendre un éventuel délai.
     *
     * Appelé par le FormController après qu'un behavior a écrit une valeur
     * pendant la soumission : la nouvelle valeur doit être jugée, pas l'ancienne.
     */
    async validateNow(): Promise<void> {
        this.validator.flush();
        await this.revalidate();
    }

    // ── events ───────────────────────────────────────────────────────────
    /** A user interaction: marks the field touched, unlike a programmatic write. */
    change(next: T | undefined): void {
        this.touched = true;
        this.assign(next);
    }

    focus(): void {
        if (this.focused) {
            return;
        }
        this.focused = true;
        this.run("onFocus");
    }

    blur(): void {
        this.focused = false;
        this.touched = true;
        this.run("onBlur");
        // `flush` après avoir lancé la revalidation : une validation différée
        // part sans attendre son délai. Quitter un champ doit trancher tout de
        // suite, pas 400 ms plus tard.
        const pending = this.revalidate();
        this.validator.flush();
        void pending;
    }

    async submit(): Promise<void> {
        this.touched = true;
        this.run("onSubmit");
        const pending = this.revalidate();
        this.validator.flush();
        await pending;
    }

    setSubmitting(submitting: boolean): void {
        if (this.submitting === submitting) {
            return;
        }
        this.submitting = submitting;
        this.commit();
    }

    reset(initialValue?: T): void {
        this.value = initialValue;
        this.touched = false;
        this.focused = false;
        this.validity = "pristine";
        this.validator.reset();
        for (const behavior of this.behaviors) {
            this.statesByBehavior.set(behavior, BehaviorState.neutral);
        }
        this.commit();
    }

    // ── read surface ─────────────────────────────────────────────────────
    /** Stable reference: safe to pass straight to `useSyncExternalStore`. */
    getSnapshot = (): FieldSnapshot<T, M> => this.current;

    get snapshot(): FieldSnapshot<T, M> {
        return this.current;
    }

    /** Stable reference: safe to pass straight to `useSyncExternalStore`. */
    listen = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    hasFlag(...flags: UiFlag[]): boolean {
        return this.current.ui.has(...flags);
    }

    view(): FieldView<T, M> {
        return {
            name: this.name,
            value: this.current.value,
            ui: this.current.ui,
            validity: this.current.ui.validity,
            errors: this.current.errors,
            options: this.current.options,
            mounted: this.current.mounted,
        };
    }

    // ── dependency reaction (driven by the FormController) ───────────────
    notifyDependency(dependency: AnyFieldView): void {
        if (!this.lifecycle.isMounted) {
            return;
        }
        const signal = this.abort.signal;
        for (const behavior of this.behaviors) {
            if (!behavior.watch?.includes(dependency.name)) {
                continue;
            }
            const ctx = this.buildContext(behavior, signal);
            this.apply(behavior, behavior.onDependencyChanged?.(ctx, dependency), signal);
        }
        this.commit();
    }

    // ── internals ────────────────────────────────────────────────────────
    /** Programmatic write: same propagation as `change`, without marking touched. */
    private assign(next: T | undefined): void {
        if (Object.is(this.value, next)) {
            return;
        }
        this.value = next;
        this.runChange(next);
        void this.revalidate();
    }

    private async revalidate(): Promise<void> {
        // Re-sent on every run: `required` can change after construction, and
        // the message must not be dropped along the way.
        this.validator.setOptions({ required: this.required, requiredMessage: this.requiredMessage });
        await this.validator.handle(this.value);
        this.commit();
    }

    private run(hook: BehaviorHook): void {
        const signal = this.abort.signal;
        for (const behavior of this.behaviors) {
            const ctx = this.buildContext(behavior, signal);
            this.apply(behavior, behavior[hook]?.(ctx), signal);
        }
        this.commit();
    }

    private runChange(value: T | undefined): void {
        const signal = this.abort.signal;
        for (const behavior of this.behaviors) {
            const ctx = this.buildContext(behavior, signal);
            this.apply(behavior, behavior.onChange?.(ctx, value), signal);
        }
        this.commit();
    }

    private apply(behavior: IBehavior<T, M>, result: BehaviorResult, signal: AbortSignal): void {
        if (result instanceof BehaviorState) {
            this.statesByBehavior.set(behavior, result);
            return;
        }
        if (!isPromise(result)) {
            // Returning nothing means "no opinion": the previous slice is kept.
            return;
        }
        void result
            .then((state) => {
                if (signal.aborted || !(state instanceof BehaviorState)) {
                    return;
                }
                this.statesByBehavior.set(behavior, state);
                this.commit();
            })
            .catch(() => {
                if (signal.aborted) {
                    return;
                }
                // A rejected behavior must not leave the field stuck on `loading`.
                const previous = this.statesByBehavior.get(behavior) ?? BehaviorState.neutral;
                this.statesByBehavior.set(behavior, previous.idle());
                this.commit();
            });
    }

    private buildContext(behavior: IBehavior<T, M>, signal: AbortSignal): BehaviorContext<T, M> {
        const watch = behavior.watch ?? [];
        // Captured explicitly: `state`, `ui` and `form` are getters, so they must
        // read the controller live — a behavior that resumes after an `await`
        // needs the current values, not those captured when the hook was called.
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- object-literal getters need the instance captured
        const field = this;

        return {
            name: this.name,
            get state(): BehaviorState {
                return field.statesByBehavior.get(behavior) ?? BehaviorState.neutral;
            },
            get ui(): UiState {
                return field.current.ui;
            },
            get form(): FormView {
                return field.host?.formView() ?? detachedForm(field.name);
            },
            signal,
            getValue: () => this.value,
            setValue: (next) => this.assign(next),
            setOptions: (options) => {
                this.options = options;
                this.commit();
            },
            watched: (name) => {
                if (!watch.includes(name)) {
                    throw new Error(
                        `[slz] Behavior on "${this.name}" reads "${name}" without declaring it in \`watch\`.`,
                    );
                }
                return this.host?.formView().field(name) ?? null;
            },
            push: (state) => {
                if (signal.aborted) {
                    return;
                }
                this.statesByBehavior.set(behavior, state);
                this.commit();
            },
        };
    }

    private commit(): void {
        const next = this.buildSnapshot();
        if (this.current.equals(next)) {
            return;
        }
        const valueChanged = !Object.is(this.current.value, next.value);
        this.current = next;
        for (const listener of this.listeners) {
            listener();
        }
        this.host?.notifyFieldChanged(this.name, valueChanged);
    }

    private buildSnapshot(): FieldSnapshot<T, M> {
        const state = this.validator.getState();
        this.validity = this.resolveValidity(state.status);

        return new FieldSnapshot<T, M>({
            name: this.name,
            value: this.value,
            // A submitting form locks its fields: that is a controller-level fact,
            // not something every consumer should have to re-derive from
            // `isSubmitting` next to `isLocked`.
            ui: UiState.merge(
                this.validity,
                this.statesByBehavior.values(),
                state.status === "loading",
                this.submitting ? ["locked"] : [],
            ),
            errors: state.errors,
            options: this.options,
            touched: this.touched,
            focused: this.focused,
            required: this.required,
            submitting: this.submitting,
            mounted: this.lifecycle.isMounted,
        });
    }

    private resolveValidity(status: ValidatorStatus): ValidityFlag {
        if (!this.touched) {
            return "pristine";
        }
        switch (status) {
            case "error":
                return "error";
            case "valid":
                return "valid";
            case "loading":
                // Keep the last verdict while revalidating instead of flashing pristine.
                return this.validity;
            case "pristine":
                return "pristine";
        }
    }
}

function isPromise(value: unknown): value is Promise<BehaviorState | void> {
    return typeof (value as Promise<unknown> | undefined)?.then === "function";
}

/** A field used outside any form still gets a valid, empty read surface. */
function detachedForm(name: string): FormView {
    return {
        name: `<detached:${name}>`,
        status: "idle",
        field: () => null,
        values: () => ({}),
    };
}
