/* eslint-disable @typescript-eslint/no-explicit-any */
import { FieldController, type FieldHost, type FieldParams, type FieldView } from "../field";
import { Lifecycle } from "../lifecycle";
import { DependencyGraph } from "./DependencyGraph";
import { FormSnapshot, type FieldSummary } from "./FormSnapshot";
import type { FormStatus, FormView } from "./FormView";

type Listener = () => void;
type AnyField = FieldController<any>;

export interface FormParams {
    name: string;
}

/**
 * Orchestrates the Fields of one form: it is where a field **joins** a form.
 *
 * The consumer never builds a FieldController by hand — it calls `field(name)`,
 * which creates it on first call and returns the same instance afterwards. That
 * is what makes adding a field a one-line change in the view, with nothing to
 * declare up front.
 *
 * It stays a coordinator, not a God Object (invariant 24): the cross-field
 * graph lives in `DependencyGraph`, the per-field state in each
 * `FieldController`, and the aggregate in `FormSnapshot`.
 */
export class FormController implements FieldHost {
    readonly name: string;

    private readonly lifecycle = new Lifecycle();
    private readonly fields = new Map<string, AnyField>();
    private readonly graph = new DependencyGraph();
    private readonly listeners = new Set<Listener>();
    private readonly readOnlyView: FormView;

    private status: FormStatus = "idle";
    private current: FormSnapshot;
    /** Re-entrancy guard: a propagation must not trigger another propagation. */
    private propagating = false;

    constructor(params: FormParams) {
        this.name = params.name;
        this.current = this.buildSnapshot();

        // eslint-disable-next-line @typescript-eslint/no-this-alias -- object-literal getters need the instance captured
        const form = this;
        this.readOnlyView = {
            name: this.name,
            get status(): FormStatus {
                return form.status;
            },
            field: (name) => form.fields.get(name)?.view() ?? null,
            values: () => form.values(),
        };
    }

    // ── field registration ───────────────────────────────────────────────
    /**
     * Returns the field named `name`, creating it on first call.
     *
     * `params` are read at creation only: identity (behaviors, validator) is
     * fixed for the field's lifetime, so passing inline objects from a React
     * render is safe. Later changes go through `FieldController.update`.
     */
    field<T = string>(name: string, params?: Omit<FieldParams<T>, "name">): FieldController<T> {
        const existing = this.fields.get(name);
        if (existing) {
            return existing as FieldController<T>;
        }

        const controller = new FieldController<T>({ ...params, name });
        controller.attach(this);
        this.fields.set(name, controller);

        try {
            this.graph.register(name, controller.dependencies());
        } catch (error) {
            this.fields.delete(name);
            throw error;
        }

        this.commit();
        return controller;
    }

    has(name: string): boolean {
        return this.fields.has(name);
    }

    get(name: string): AnyField | null {
        return this.fields.get(name) ?? null;
    }

    remove(name: string): void {
        const field = this.fields.get(name);
        if (!field) {
            return;
        }
        field.unmount();
        this.fields.delete(name);
        this.graph.unregister(name);
        this.commit();
    }

    names(): readonly string[] {
        return [...this.fields.keys()];
    }

    // ── FieldHost ────────────────────────────────────────────────────────
    formView(): FormView {
        return this.readOnlyView;
    }

    notifyFieldChanged(name: string): void {
        this.commit();

        if (this.propagating) {
            return;
        }
        const observers = this.graph.observersOf(name);
        const source = this.fields.get(name);
        if (observers.length === 0 || !source) {
            return;
        }

        this.propagating = true;
        try {
            const view: FieldView = source.view();
            for (const observer of observers) {
                this.fields.get(observer)?.notifyDependency(view);
            }
        } finally {
            this.propagating = false;
        }
    }

    // ── lifecycle ────────────────────────────────────────────────────────
    mount(): void {
        this.lifecycle.mount();
    }

    update(mutate: () => void): boolean {
        return this.lifecycle.update(mutate);
    }

    unmount(): void {
        if (!this.lifecycle.unmount()) {
            return;
        }
        for (const field of this.fields.values()) {
            field.unmount();
        }
    }

    get isMounted(): boolean {
        return this.lifecycle.isMounted;
    }

    get isUnmounted(): boolean {
        return this.lifecycle.isUnmounted;
    }

    // ── submission ───────────────────────────────────────────────────────
    /** Touches and revalidates every mounted field. Resolves to the form's validity. */
    async submit(): Promise<boolean> {
        this.setStatus("submitting");
        const mounted = [...this.fields.values()].filter((field) => field.isMounted);

        for (const field of mounted) {
            field.setSubmitting(true);
        }
        await Promise.all(mounted.map((field) => field.submit()));
        for (const field of mounted) {
            field.setSubmitting(false);
        }

        const valid = this.buildSnapshot().isValid;
        this.setStatus(valid ? "submitted" : "idle");
        return valid;
    }

    reset(): void {
        for (const field of this.fields.values()) {
            field.reset();
        }
        this.setStatus("idle");
    }

    // ── read surface ─────────────────────────────────────────────────────
    /** Stable reference: safe to pass straight to `useSyncExternalStore`. */
    getSnapshot = (): FormSnapshot => this.current;

    get snapshot(): FormSnapshot {
        return this.current;
    }

    /** Stable reference: safe to pass straight to `useSyncExternalStore`. */
    listen = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    values(): Readonly<Record<string, unknown>> {
        const values: Record<string, unknown> = {};
        for (const [name, field] of this.fields) {
            values[name] = field.snapshot.value;
        }
        return values;
    }

    // ── internals ────────────────────────────────────────────────────────
    private setStatus(status: FormStatus): void {
        if (this.status === status) {
            return;
        }
        this.status = status;
        this.commit();
    }

    private commit(): void {
        const next = this.buildSnapshot();
        if (this.current.equals(next)) {
            return;
        }
        this.current = next;
        for (const listener of this.listeners) {
            listener();
        }
    }

    private buildSnapshot(): FormSnapshot {
        const summaries: FieldSummary[] = [];
        for (const [name, field] of this.fields) {
            const snapshot = field.snapshot;
            summaries.push({
                name,
                value: snapshot.value,
                validity: snapshot.ui.validity,
                errors: snapshot.errors,
                mounted: snapshot.mounted,
            });
        }
        return new FormSnapshot(this.name, this.status, summaries);
    }
}
