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
const MAX_PROPAGATION_DEPTH = 50;

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
    private readonly queue: { name: string; changes: FieldChanges; depth: number }[] = [];
    private draining = false;
    /** Profondeur du maillon en cours de traitement, pour borner les chaînes. */
    private depth = 0;

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
            // Un champ, ou une liste : les deux se déclarent dans `watch`, les
            // deux doivent donc se lire.
            field: (name) => form.fields.get(name)?.view() ?? form.arrayView(name),
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
            onChanged: (valuesChanged) => this.notifyFieldChanged(name, {
                // Seule une vraie modification des **valeurs** propage. Un
                // montage de champ, un `touched` ou un `loading` dans une ligne
                // n'en est pas une : les signaler relancerait les appels réseau
                // qui observent la liste, y compris pendant la soumission
                // (arbitrage 18).
                value: valuesChanged, validity: false, activity: false,
            }),
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

    /**
     * Le contrôleur d'un champ existant, typé depuis la map.
     *
     * Rendre `FieldController<any, any>` faisait de cette méthode un trou dans
     * le typage : `form.get("a")?.change(12345)` compilait sur une map qui
     * déclare `a: string`.
     */
    get<K extends FieldNameOf<TFields>>(
        name: K,
    ): FieldController<ValueOf<TFields[K]>, MetaOf<TFields[K]>> | null {
        return (this.fields.get(name) ?? null) as
            FieldController<ValueOf<TFields[K]>, MetaOf<TFields[K]>> | null;
    }

    /** Retire une liste et démonte ses lignes. */
    removeArray(name: ArrayNameOf<TFields>): void {
        const rows = this.arrays.get(name);
        if (!rows) {
            return;
        }
        rows.unmount();
        this.arrays.delete(name);
        this.graph.unregister(name);
        this.commit();
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

        this.queue.push({ name, changes, depth: this.depth + 1 });

        // Déjà dans la boucle : l'écriture qui vient d'être faite sera traitée
        // par le tour suivant. Sans cette file, la garde de réentrance avalait
        // silencieusement le deuxième maillon d'une chaîne synchrone.
        if (this.draining) {
            return;
        }

        this.draining = true;
        try {
            while (this.queue.length > 0) {
                const next = this.queue.shift();
                if (!next) {
                    continue;
                }
                // La borne porte sur la **profondeur de chaîne**, jamais sur le
                // volume : cent champs observant un même pays, c'est cent
                // dispatches pour une seule étape, et c'est parfaitement normal.
                if (next.depth > MAX_PROPAGATION_DEPTH) {
                    throw new Error(
                        `[slz] Propagation ne converge pas dans "${this.name}" `
                        + `après ${MAX_PROPAGATION_DEPTH} maillons : un behavior écrit-il en boucle ?`,
                    );
                }
                this.depth = next.depth;
                this.dispatch(next.name, next.changes);
            }
        } finally {
            this.draining = false;
            this.depth = 0;
            this.queue.length = 0;
        }
    }

    private dispatch(name: string, changes: FieldChanges): void {
        const observers = this.graph.observersOf(name);
        if (observers.length === 0) {
            return;
        }

        // La source est un champ, ou une liste : les deux s'observent.
        const view = this.fields.get(name)?.view() ?? this.arrayView(name);
        if (!view) {
            return;
        }

        for (const observer of observers) {
            this.fields.get(observer)?.notifyDependency(view, changes);
        }
    }

    /**
     * Projection d'une liste sous la forme que voit un observateur.
     *
     * Sa valeur est le tableau de ses lignes, et son verdict celui de
     * l'ensemble — ce qu'il faut pour qu'une règle « la somme fait 100 »
     * déclare simplement `watch: ["lines"]`.
     */
    /** Lue aussi par la surface de lecture du formulaire, d'où l'absence de `private`. */
    arrayView(name: string): AnyFieldView | null {
        const rows = this.arrays.get(name);
        if (!rows) {
            return null;
        }
        const ui = rows.ui;
        const errors = rows.errors;
        return {
            name,
            value: rows.values(),
            ui,
            errors,
            issues: [],
            options: [],
            hasFlag: (...flags) => ui.hasFlag(...flags),
            hasAny: (...flags) => ui.hasAny(...flags),
        };
    }

    // ── lifecycle ────────────────────────────────────────────────────────
    mount(): void {
        this.lifecycle.mount();
        // Symétrique de `unmount`, qui descend jusqu'aux champs : sans ça un
        // cycle démontage/remontage vidait le payload en silence.
        for (const field of this.fields.values()) {
            field.mount();
        }
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
        if (this.lifecycle.isUnmounted) {
            return;
        }
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

        try {
            return await this.runSubmit(mounted);
        } finally {
            // Sans ce `finally`, la moindre exception — y compris levée par une
            // garde du moteur — laissait le formulaire verrouillé sur
            // « submitting », sans aucun chemin de sortie : `reset()` lui-même
            // ne remettait pas `submitting` à zéro.
            // Tous les champs, pas la liste figée à l'entrée : un champ monté
            // pendant la soumission a pris le verrou au montage, et ne serait
            // jamais relâché s'il fallait avoir été présent au départ.
            for (const field of this.fields.values()) {
                field.setSubmitting(false);
            }
            this.leaveSubmitting();
        }
    }

    /** Quitte l'état de soumission s'il n'a pas déjà été tranché. */
    private leaveSubmitting(): void {
        if (this.status === "submitting") {
            this.setStatus("idle");
        }
    }

    private async runSubmit(mounted: readonly AnyField[]): Promise<boolean> {

        // `field.submit()` touche le champ, déclenche `onSubmit` — ce qui fait
        // partir les fenêtres différées — et revalide.
        //
        // Borné : un validator dont la promesse ne retombe jamais — un `fetch`
        // sans timeout — bloquerait ici, hors de toute deadline, et laisserait
        // le formulaire verrouillé à vie.
        const touched = await withDeadline(
            Promise.all(mounted.map((field) => field.submit())),
            this.settleTimeout,
        );

        // Les lignes sont soumises avec le reste : leurs valeurs doivent être
        // posées et jugées avant qu'on statue sur le formulaire.
        const rowsValid = (await Promise.all(
            [...this.arrays.values()].map((rows) => rows.submit()),
        )).every(Boolean);

        const settled = touched && await this.settle(mounted);

        if (!settled) {
            // La convergence a expiré : un champ est resté en vol. Sans ça il
            // garderait `loading` + `locked` indéfiniment, et **toutes** les
            // soumissions suivantes échoueraient.
            for (const field of mounted) {
                field.recover();
            }
        }

        const valid = settled && rowsValid && this.buildSnapshot().hasFlag("valid");
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
        const before = new Map<AnyField, unknown>(fields.map((field) => [field, field.snapshot.value]));

        for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
            const wasBusy = fields.some((field) => field.isBusy);
            if (!(await this.waitIdle(fields, deadline))) {
                return false;
            }
            // Rien n'était en vol au premier tour : `field.submit()` vient de
            // valider, et aucune valeur n'a pu bouger depuis. Revalider ici
            // doublerait chaque appel réseau de validation, à chaque soumission.
            if (!wasBusy) {
                return true;
            }

            // Et même quand quelque chose était en vol, seuls les champs dont
            // la **valeur** a bougé pendant l'attente ont besoin d'être rejugés.
            // Rejouer tout le formulaire multipliait les vérifications réseau
            // par le nombre de champs.
            const changed = fields.filter((field) => !Object.is(field.snapshot.value, before.get(field)));
            for (const field of fields) {
                before.set(field, field.snapshot.value);
            }
            await Promise.all(changed.map((field) => field.validateNow()));
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
                ui: snapshot.ui,
                errors: snapshot.errors,
            });
        }
        const arrays = [...this.arrays.entries()].map(([name, rows]) => ({
            name,
            ui: rows.ui,
            values: rows.values(),
            errors: rows.errors,
        }));
        return new FormSnapshot(this.name, this.status, summaries, arrays);
    }
}

/**
 * Résout `false` si la promesse n'a pas retombé dans le temps imparti.
 *
 * La promesse continue sa vie — on ne peut pas l'annuler — mais la soumission,
 * elle, cesse d'attendre : un appel réseau sans timeout ne doit pas condamner
 * le formulaire.
 */
function withDeadline(work: Promise<unknown>, timeout: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), timeout);
        void work.then(
            () => { clearTimeout(timer); resolve(true); },
            () => { clearTimeout(timer); resolve(false); },
        );
    });
}
