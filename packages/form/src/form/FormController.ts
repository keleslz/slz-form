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
import type { FieldChanges } from "../behavior/IBehavior";
import { FieldArrayController } from "../array/FieldArrayController";
import type { ArrayNameOf, PlainNameOf, RowOf } from "../array/FieldArray";
import { Lifecycle } from "../lifecycle";
import { DependencyGraph } from "./DependencyGraph";
import { FormSnapshot, type FieldSummary } from "./FormSnapshot";
import type { FormStatus, FormView } from "./FormView";

type Listener = () => void;
type AnyField = FieldController<any, any>;

/**
 * Les noms de champs simples déclarés par la map — les listes en sont exclues,
 * elles passent par `form.array(...)`.
 */
export type FieldNameOf<TFields extends FieldsShape> = PlainNameOf<TFields>;

/** Passes de convergence avant d'abandonner : couvre les lookups en chaîne. */
const MAX_SETTLE_ROUNDS = 5;
/** Filet de sécurité : le graphe interdit les cycles, ceci attrape les oscillations. */
const MAX_PROPAGATION_STEPS = 100;

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
    private readonly arrays = new Map<string, FieldArrayController<FieldsShape>>();
    private readonly graph = new DependencyGraph();
    private readonly listeners = new Set<Listener>();
    private readonly readOnlyView: FormView;

    private readonly settleTimeout: number;
    private status: FormStatus = "idle";
    private current: FormSnapshot;
    /**
     * File de propagation. Une écriture faite pendant une propagation y est
     * empilée au lieu d'être perdue : c'est ce qui fait qu'une chaîne
     * **synchrone** a → b → c va jusqu'au bout.
     */
    private readonly queue: { name: string; changes: FieldChanges }[] = [];
    private draining = false;

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

    /**
     * La liste nommée `name`, créée au premier appel — symétrique de `field()`.
     *
     * Chaque ligne est un `FormController` à part entière : sa validation, son
     * graphe de dépendances et ses instantanés sont ceux qu'on connaît déjà.
     */
    array<K extends ArrayNameOf<TFields>>(name: K): FieldArrayController<RowOf<TFields[K]>> {
        type Rows = FieldArrayController<RowOf<TFields[K]>>;

        const existing = this.arrays.get(name);
        if (existing) {
            return existing as unknown as Rows;
        }

        const controller = new FieldArrayController<RowOf<TFields[K]>>({
            name,
            createRow: (id) => new FormController<RowOf<TFields[K]>>({
                name: id,
                settleTimeout: this.settleTimeout,
            }),
            onChanged: () => this.commit(),
        });

        this.arrays.set(name, controller as unknown as FieldArrayController<FieldsShape>);
        if (this.lifecycle.isMounted) {
            controller.mount();
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

    notifyFieldChanged(name: string, changes: FieldChanges): void {
        this.commit();

        if (!changes.value && !changes.validity && !changes.activity) {
            return;
        }

        this.queue.push({ name, changes });

        // Déjà dans la boucle : l'écriture qui vient d'être faite sera traitée
        // par le tour suivant. Sans cette file, la garde de réentrance avalait
        // silencieusement le deuxième maillon d'une chaîne synchrone.
        if (this.draining) {
            return;
        }

        this.draining = true;
        try {
            let steps = 0;
            while (this.queue.length > 0) {
                steps += 1;
                if (steps > MAX_PROPAGATION_STEPS) {
                    // Le graphe interdit les cycles, donc on ne devrait jamais
                    // arriver ici — sauf si un behavior fait osciller une valeur.
                    throw new Error(
                        `[slz] Propagation ne converge pas dans "${this.name}" `
                        + `après ${MAX_PROPAGATION_STEPS} étapes : un behavior écrit-il en boucle ?`,
                    );
                }
                const next = this.queue.shift();
                if (next) {
                    this.dispatch(next.name, next.changes);
                }
            }
        } finally {
            this.draining = false;
            this.queue.length = 0;
        }
    }

    private dispatch(name: string, changes: FieldChanges): void {
        const observers = this.graph.observersOf(name);
        const source = this.fields.get(name);
        if (observers.length === 0 || !source) {
            return;
        }

        const view: AnyFieldView = source.view();
        for (const observer of observers) {
            this.fields.get(observer)?.notifyDependency(view, changes);
        }
    }

    // ── lifecycle ────────────────────────────────────────────────────────
    mount(): void {
        this.lifecycle.mount();
        for (const rows of this.arrays.values()) {
            rows.mount();
        }
    }

    /** Un travail asynchrone est en cours, dans un champ ou dans une ligne. */
    get isBusy(): boolean {
        return [...this.fields.values()].some((field) => field.isBusy)
            || [...this.arrays.values()].some((rows) => rows.isBusy);
    }

    update(mutate: () => void): boolean {
        return this.lifecycle.update(mutate);
    }

    unmount(): void {
        for (const rows of this.arrays.values()) {
            rows.unmount();
        }
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
        // Deux soumissions concurrentes partaient toutes les deux.
        if (this.status === "submitting") {
            return false;
        }
        this.setStatus("submitting");
        const mounted = [...this.fields.values()].filter((field) => field.isMounted);

        for (const field of mounted) {
            field.setSubmitting(true);
        }

        // `field.submit()` touche le champ, déclenche `onSubmit` — ce qui fait
        // partir les fenêtres différées — et revalide.
        await Promise.all(mounted.map((field) => field.submit()));

        // Les lignes sont soumises avec le reste : leurs valeurs doivent être
        // posées et jugées avant qu'on statue sur le formulaire.
        const rowsValid = (await Promise.all(
            [...this.arrays.values()].map((rows) => rows.submit()),
        )).every(Boolean);

        const settled = await this.settle(mounted);

        if (!settled) {
            // La convergence a expiré : un champ est resté en vol. Sans ça il
            // garderait `loading` + `locked` indéfiniment, et **toutes** les
            // soumissions suivantes échoueraient.
            for (const field of mounted) {
                field.recover();
            }
        }

        for (const field of mounted) {
            field.setSubmitting(false);
        }

        const valid = settled && rowsValid && this.buildSnapshot().isValid;
        this.setStatus(valid ? "submitted" : "idle");
        return valid;
    }

    reset(): void {
        for (const field of this.fields.values()) {
            field.reset();
        }
        for (const rows of this.arrays.values()) {
            rows.reset();
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

    /** Le payload : ni les champs démontés, ni les champs masqués. */
    values(): Readonly<Record<string, unknown>> {
        return this.buildSnapshot().values;
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
                blocking: snapshot.isBlocking,
                visible: snapshot.isVisible,
                mounted: snapshot.mounted,
            });
        }
        const arrays = [...this.arrays.entries()].map(([name, rows]) => ({
            name,
            valid: rows.isValid,
            values: rows.values(),
        }));
        return new FormSnapshot(this.name, this.status, summaries, arrays);
    }
}
