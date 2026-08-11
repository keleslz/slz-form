/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    FieldController,
    type FieldHost,
    type FieldParams,
    type FieldsShape,
    type AnyFieldView,
    type MetaOf,
    type ValueOf,
} from "../field";
import { Lifecycle } from "../lifecycle";
import { DependencyGraph } from "./DependencyGraph";
import { FormSnapshot, type FieldSummary } from "./FormSnapshot";
import type { FormStatus, FormView } from "./FormView";

type Listener = () => void;
type AnyField = FieldController<any, any>;

/** Les noms de champs déclarés par la map du formulaire. */
export type FieldNameOf<TFields extends FieldsShape> = Extract<keyof TFields, string>;

/** Passes de convergence avant d'abandonner : couvre les lookups en chaîne. */
const MAX_SETTLE_ROUNDS = 5;

export interface FormParams {
    name: string;
    /**
     * Temps maximum accordé, à la soumission, pour que tout travail asynchrone
     * en cours se termine. Dépassé, la soumission échoue au lieu de partir avec
     * des valeurs incomplètes. Défaut : 10 s.
     */
    settleTimeout?: number;
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
export class FormController<TFields extends FieldsShape = FieldsShape> implements FieldHost {
    readonly name: string;

    private readonly lifecycle = new Lifecycle();
    private readonly fields = new Map<string, AnyField>();
    private readonly graph = new DependencyGraph();
    private readonly listeners = new Set<Listener>();
    private readonly readOnlyView: FormView;

    private readonly settleTimeout: number;
    private status: FormStatus = "idle";
    private current: FormSnapshot;
    /** Re-entrancy guard: a propagation must not trigger another propagation. */
    private propagating = false;

    constructor(params: FormParams) {
        this.name = params.name;
        this.settleTimeout = params.settleTimeout ?? 10_000;
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
    field<K extends FieldNameOf<TFields>>(
        name: K,
        params?: Omit<FieldParams<ValueOf<TFields[K]>, MetaOf<TFields[K]>>, "name">,
    ): FieldController<ValueOf<TFields[K]>, MetaOf<TFields[K]>> {
        type Controller = FieldController<ValueOf<TFields[K]>, MetaOf<TFields[K]>>;

        const existing = this.fields.get(name);
        if (existing) {
            return existing as Controller;
        }

        const controller: Controller = new FieldController({ ...params, name });
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

    has(name: FieldNameOf<TFields>): boolean {
        return this.fields.has(name);
    }

    get(name: FieldNameOf<TFields>): AnyField | null {
        return this.fields.get(name) ?? null;
    }

    remove(name: FieldNameOf<TFields>): void {
        const field = this.fields.get(name);
        if (!field) {
            return;
        }
        field.unmount();
        this.fields.delete(name);
        this.graph.unregister(name);
        this.commit();
    }

    names(): readonly FieldNameOf<TFields>[] {
        return [...this.fields.keys()] as FieldNameOf<TFields>[];
    }

    // ── FieldHost ────────────────────────────────────────────────────────
    formView(): FormView {
        return this.readOnlyView;
    }

    notifyFieldChanged(name: string, valueChanged: boolean): void {
        this.commit();

        // Une dépendance se déclenche sur la *valeur* observée, pas sur l'état
        // du champ observé. Sans ça, toucher un champ ou le revalider rejouait
        // les lookups qui l'observent — au point de relancer un appel réseau
        // pendant la soumission.
        if (!valueChanged || this.propagating) {
            return;
        }
        const observers = this.graph.observersOf(name);
        const source = this.fields.get(name);
        if (observers.length === 0 || !source) {
            return;
        }

        this.propagating = true;
        try {
            const view: AnyFieldView = source.view();
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
    /**
     * Marque tous les champs montés comme touchés, fait partir sans attendre
     * tout travail différé, **attend que plus rien ne soit en vol**, puis statue.
     *
     * L'attente est le point important : un behavior asynchrone qui écrit une
     * valeur doit avoir fini avant qu'on juge le formulaire, sinon on soumet une
     * valeur qui n'est pas encore posée.
     *
     * Renvoie `false` si le formulaire est invalide **ou** si les valeurs n'ont
     * pas convergé dans le temps imparti — dans les deux cas, rien n'est soumis.
     */
    async submit(): Promise<boolean> {
        this.setStatus("submitting");
        const mounted = [...this.fields.values()].filter((field) => field.isMounted);

        for (const field of mounted) {
            field.setSubmitting(true);
        }

        // `field.submit()` touche le champ, déclenche `onSubmit` — ce qui fait
        // partir les fenêtres différées — et revalide.
        await Promise.all(mounted.map((field) => field.submit()));

        const settled = await this.settle(mounted);

        for (const field of mounted) {
            field.setSubmitting(false);
        }

        const valid = settled && this.buildSnapshot().isValid;
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
    /**
     * Attend que plus aucun champ ne soit en vol, puis revalide : une valeur
     * écrite pendant l'attente doit être jugée, pas celle qu'elle a remplacée.
     *
     * Boucle, parce qu'une écriture peut en déclencher une autre — un lookup en
     * chaîne (code postal → ville → région). Bornée en passes et dans le temps.
     */
    private async settle(fields: readonly AnyField[]): Promise<boolean> {
        const deadline = Date.now() + this.settleTimeout;

        for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
            if (!(await this.waitIdle(fields, deadline))) {
                return false;
            }
            await Promise.all(fields.map((field) => field.validateNow()));
            if (!fields.some((field) => field.isBusy)) {
                return true;
            }
        }
        return false;
    }

    private waitIdle(fields: readonly AnyField[], deadline: number): Promise<boolean> {
        if (!fields.some((field) => field.isBusy)) {
            return Promise.resolve(true);
        }

        return new Promise<boolean>((resolve) => {
            const unsubscribes: (() => void)[] = [];

            const done = (settled: boolean) => {
                clearTimeout(timer);
                for (const unsubscribe of unsubscribes) {
                    unsubscribe();
                }
                resolve(settled);
            };

            // Un champ qui cesse d'être en vol modifie forcément son snapshot,
            // donc notifie : pas besoin de scruter.
            for (const field of fields) {
                unsubscribes.push(field.listen(() => {
                    if (!fields.some((f) => f.isBusy)) {
                        done(true);
                    }
                }));
            }

            const timer = setTimeout(() => done(false), Math.max(0, deadline - Date.now()));
        });
    }

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
