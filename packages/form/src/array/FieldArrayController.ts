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
    readonly onChanged: (valuesChanged: boolean) => void;
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
    private readonly onChanged: (valuesChanged: boolean) => void;
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
    private lastValues: readonly Readonly<Record<string, unknown>>[] = [];

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
        this.rowSubscriptions.set(id, row.form.listen(() => this.publishContent()));
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

    /**
     * Repart de l'état initial : une liste naît vide, donc la remise à zéro la
     * vide. Réinitialiser le contenu en gardant N lignes vides laisserait un
     * formulaire « remis à zéro » qui ne l'est pas.
     */
    reset(): void {
        this.clear();
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

    /**
     * Une ligne a notifié. Ne remonter au parent que si ses **valeurs** ont
     * bougé : monter un champ, le toucher ou le passer en `loading` n'en est
     * pas une, et le signaler relancerait les appels qui observent la liste —
     * jusqu'à pendant la soumission (arbitrage 18).
     */
    private publishContent(): void {
        const next = this.values();
        const changed = !sameValues(next, this.lastValues);
        this.lastValues = next;
        this.onChanged(changed);
    }

    private publish(): void {
        // Nouvelle référence à chaque modification de la liste : c'est le
        // changement d'ordre ou de composition qui doit re-rendre, pas le
        // contenu d'une ligne — chaque ligne a déjà ses propres abonnés.
        this.current = [...this.entries];
        for (const listener of this.listeners) {
            listener();
        }
        this.lastValues = this.values();
        // Ajouter, retirer ou déplacer une ligne change toujours le payload.
        this.onChanged(true);
    }
}

/**
 * Comparaison structurelle des valeurs de lignes.
 *
 * Volontairement pas `JSON.stringify` : il **lève** sur une structure
 * circulaire ou un `BigInt` — depuis `change()`, donc dans le code appelant —
 * et il est **aveugle** à ce qu'il ne sait pas sérialiser, un `File` du DOM se
 * réduisant à `{}`. Or le moteur revendique `File` et `Date` comme valeurs.
 */
function sameValues(
    a: readonly Readonly<Record<string, unknown>>[],
    b: readonly Readonly<Record<string, unknown>>[],
): boolean {
    return a.length === b.length && a.every((row, i) => sameRow(row, b[i]));
}

function sameRow(
    a: Readonly<Record<string, unknown>>,
    b: Readonly<Record<string, unknown>> | undefined,
): boolean {
    if (b === undefined) {
        return false;
    }
    // Une clé absente et une clé à `undefined` décrivent le même payload : un
    // champ monté mais pas encore rempli n'est pas un changement de valeur.
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => Object.is(a[key], b[key]));
}
