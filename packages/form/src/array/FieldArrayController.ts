import type { FieldsShape } from "../field/Field";
import type { FormController } from "../form/FormController";
import { FieldArrayRow } from "./FieldArrayRow";

type Listener = () => void;

export interface FieldArrayParams<TRow extends FieldsShape> {
    readonly name: string;
    /**
     * Fabrique le formulaire d'une ligne. Injectée par le FormController parent
     * plutôt qu'importée : sans ça, `FormController` et ce fichier
     * s'importeraient mutuellement à l'exécution.
     */
    readonly createRow: (id: string) => FormController<TRow>;
    /** Prévient le parent qu'il doit republier son instantané. */
    readonly onChanged: () => void;
}

/**
 * Une liste de lignes répétables.
 *
 * Ajouter, retirer et déplacer sont des opérations sur un tableau : aucun champ
 * n'est renommé, donc aucune dépendance déclarée ne se retrouve à pointer dans
 * le vide. C'est tout l'intérêt d'identifier les lignes plutôt que de les
 * indexer.
 *
 * Les règles qui portent sur l'ensemble — « la somme fait 100 % » — s'écrivent
 * dans un validator du formulaire parent qui déclare `watch: ["lines"]` : rien
 * de spécifique n'est prévu ici pour ce cas.
 */
export class FieldArrayController<TRow extends FieldsShape> {
    readonly name: string;

    private readonly createRow: (id: string) => FormController<TRow>;
    private readonly onChanged: () => void;
    private readonly listeners = new Set<Listener>();
    private entries: FieldArrayRow<TRow>[] = [];
    /**
     * Abonnement au contenu de chaque ligne. Le parent agrège la validité et le
     * payload des lignes : sans ça son instantané resterait périmé dès qu'on
     * tape dans une ligne. Seul `useForm` en pâtit — il est fait pour ça —, les
     * champs gardent leurs abonnements individuels.
     */
    private readonly rowSubscriptions = new Map<string, () => void>();
    private current: readonly FieldArrayRow<TRow>[] = [];
    /** Monotone : un identifiant libéré n'est jamais réattribué. */
    private nextId = 0;
    private mounted = false;

    constructor(params: FieldArrayParams<TRow>) {
        this.name = params.name;
        this.createRow = params.createRow;
        this.onChanged = params.onChanged;
    }

    get rows(): readonly FieldArrayRow<TRow>[] {
        return this.current;
    }

    get length(): number {
        return this.entries.length;
    }

    /** Ajoute une ligne et rend son identifiant. */
    append(): string {
        this.nextId += 1;
        const id = `${this.name}#${this.nextId}`;
        const row = new FieldArrayRow(id, this.createRow(id));
        this.rowSubscriptions.set(id, row.form.listen(() => this.onChanged()));
        this.entries.push(row);
        if (this.mounted) {
            row.form.mount();
        }
        this.publish();
        return id;
    }

    remove(id: string): void {
        const index = this.entries.findIndex((row) => row.id === id);
        if (index < 0) {
            return;
        }
        const [removed] = this.entries.splice(index, 1);
        this.rowSubscriptions.get(id)?.();
        this.rowSubscriptions.delete(id);
        removed?.form.unmount();
        this.publish();
    }

    /** Déplace une ligne. Les identifiants ne bougent pas, seul l'ordre change. */
    move(from: number, to: number): void {
        if (from === to || from < 0 || to < 0 || from >= this.entries.length || to >= this.entries.length) {
            return;
        }
        const [moved] = this.entries.splice(from, 1);
        if (moved) {
            this.entries.splice(to, 0, moved);
            this.publish();
        }
    }

    clear(): void {
        for (const row of this.entries) {
            this.rowSubscriptions.get(row.id)?.();
            this.rowSubscriptions.delete(row.id);
            row.form.unmount();
        }
        this.entries = [];
        this.publish();
    }

    row(id: string): FieldArrayRow<TRow> | null {
        return this.entries.find((entry) => entry.id === id) ?? null;
    }

    /** Le payload de la liste, ligne par ligne, dans l'ordre affiché. */
    values(): readonly Readonly<Record<string, unknown>>[] {
        return this.entries.map((row) => row.values());
    }

    get isValid(): boolean {
        return this.entries.every((row) => row.form.snapshot.isValid);
    }

    get isBusy(): boolean {
        return this.entries.some((row) => row.form.isBusy);
    }

    mount(): void {
        this.mounted = true;
        for (const row of this.entries) {
            row.form.mount();
        }
    }

    unmount(): void {
        this.mounted = false;
        for (const row of this.entries) {
            row.form.unmount();
        }
    }

    reset(): void {
        for (const row of this.entries) {
            row.form.reset();
        }
    }

    /** Touche et valide chaque ligne — appelé par la soumission du parent. */
    async submit(): Promise<boolean> {
        const results = await Promise.all(this.entries.map((row) => row.form.submit()));
        return results.every(Boolean);
    }

    /** Référence stable : utilisable tel quel dans `useSyncExternalStore`. */
    getSnapshot = (): readonly FieldArrayRow<TRow>[] => this.current;

    listen = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private publish(): void {
        // Nouvelle référence à chaque modification de la liste : c'est le
        // changement d'ordre ou de composition qui doit re-rendre, pas le
        // contenu d'une ligne — chaque ligne a déjà ses propres abonnés.
        this.current = [...this.entries];
        for (const listener of this.listeners) {
            listener();
        }
        this.onChanged();
    }
}
