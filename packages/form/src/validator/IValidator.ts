import type { AnyFieldView } from "../field/FieldView";
import type { FormView } from "../form/FormView";

export type ValidatorStatus = "pristine" | "loading" | "valid" | "error";

/**
 * Gravité d'un constat de validation.
 *
 * Seul `error` bloque. `warning` remonte à la vue sans peser sur la validité :
 * c'est ce qui permet un « ce code postal semble inhabituel » qui n'empêche pas
 * de soumettre.
 */
export type IssueSeverity = "error" | "warning";

/**
 * Un constat de validation.
 *
 * `code` est le point d'accroche du consommateur : router vers une snackbar
 * plutôt que sous le champ, traduire, regrouper. Le moteur le transporte et ne
 * s'en sert jamais — décider de l'affichage n'est pas son travail.
 */
export interface ValidationIssue {
    readonly message: string;
    readonly severity: IssueSeverity;
    readonly code?: string;
}

export interface IssueMeta {
    readonly code?: string;
}

export interface ValidatorState {
    readonly status: ValidatorStatus;
    readonly issues: readonly ValidationIssue[];
    /** Les messages bloquants seuls. Dérivé de `issues`, conservé par compatibilité. */
    readonly errors: readonly string[];
}

export interface ValidationOptions {
    required?: boolean;
    requiredMessage?: string;
    /**
     * Traite `false` comme une valeur vide, pour les cases à cocher qui doivent
     * être cochées. Sans cette option, `required` laisse passer `false` : c'est
     * une valeur booléenne parfaitement renseignée.
     */
    requiredTrue?: boolean;
}

export type ValidatorListener = () => void;

/**
 * Lecture du formulaire offerte à `validate` (invariants 8 et 9).
 *
 * Aucune méthode de mutation : le validator **juge**, il n'écrit pas. Et il ne
 * lit que ce qu'il a déclaré dans `watch` — `watched()` throw sur un nom non
 * déclaré, exactement comme pour un behavior (invariants 7 et 23).
 */
export interface ValidationContext {
    readonly name: string;
    readonly form: FormView;
    /**
     * Avorté au démontage du champ, exactement comme celui d'un behavior.
     * Une règle qui touche le réseau doit le passer à `fetch` et le vérifier
     * après chaque `await` : sans ça, retirer vingt lignes d'une liste lance
     * vingt requêtes orphelines.
     */
    readonly signal: AbortSignal;
    watched(name: string): AnyFieldView | null;
}

/**
 * Collecteur de constats remis à `validate`, propre à **une seule exécution**.
 *
 * Rien n'est accumulé sur l'instance du validator : deux validations async
 * concurrentes entremêleraient leurs messages sinon.
 */
export class ValidationReport {
    private readonly collected: ValidationIssue[] = [];
    private failed = false;

    error(message: string, meta?: IssueMeta): this {
        this.collected.push({ message, severity: "error", code: meta?.code });
        return this;
    }

    errorIf(invalid: boolean, message: string, meta?: IssueMeta): this {
        if (invalid) {
            this.error(message, meta);
        }
        return this;
    }

    /** Signale sans bloquer : `isValid` ignore les avertissements. */
    warn(message: string, meta?: IssueMeta): this {
        this.collected.push({ message, severity: "warning", code: meta?.code });
        return this;
    }

    warnIf(suspect: boolean, message: string, meta?: IssueMeta): this {
        if (suspect) {
            this.warn(message, meta);
        }
        return this;
    }

    /**
     * Marque la passe comme **interrompue** : une règle n'a pas pu conclure.
     *
     * Ce qui a été collecté reste vrai — un refus est un refus. Mais
     * l'**absence** de refus ne prouve plus rien, et ne doit donc pas être
     * publiée comme un verdict de validité.
     */
    fail(): this {
        this.failed = true;
        return this;
    }

    get interrupted(): boolean {
        return this.failed;
    }

    /** Reprend des constats déjà formés — utilisé par la composition. */
    add(issues: Iterable<ValidationIssue>): this {
        for (const issue of issues) {
            this.collected.push(issue);
        }
        return this;
    }

    get issues(): readonly ValidationIssue[] {
        return this.collected;
    }

    get errors(): readonly string[] {
        return errorsOf(this.collected);
    }

    get hasError(): boolean {
        return this.collected.some((issue) => issue.severity === "error");
    }
}

/** Les messages bloquants seuls — les avertissements n'en font pas partie. */
export function errorsOf(issues: readonly ValidationIssue[]): readonly string[] {
    return issues.filter((issue) => issue.severity === "error").map((issue) => issue.message);
}

export function sameIssues(a: readonly ValidationIssue[], b: readonly ValidationIssue[]): boolean {
    return a.length === b.length && a.every((issue, i) => {
        const other = b[i];
        return other !== undefined
            && issue.message === other.message
            && issue.severity === other.severity
            && issue.code === other.code;
    });
}

/**
 * Autorité de validité pour un champ (invariant 13). Générique sur le type de
 * valeur, ce qui couvre texte, options, multi-options, fichiers, dates, heures
 * et datetimes — on sous-classe avec le `T` voulu.
 *
 * Les behaviors ne décident jamais de la validité ; ils y réagissent.
 */
export abstract class IValidator<T = string> {
    /**
     * Champs que ce validator lit pour statuer. Le FieldController les agrège
     * dans le graphe de dépendances, ce qui déclenche une **revalidation
     * automatique** quand l'un d'eux change : c'est ce qui rend la validation
     * croisée possible sans que le consommateur ait à la rejouer à la main.
     */
    readonly watch?: readonly string[];

    /**
     * Exécuter les règles **même sur une valeur vide**.
     *
     * Par défaut une valeur vide court-circuite : seul `required` s'exprime, ce
     * qui évite qu'un validator d'email crie sur un champ facultatif laissé
     * blanc. Mais une règle qui décide elle-même de l'obligation — « obligatoire
     * si le compte est pro » — doit pouvoir se prononcer sur du vide. Elle le
     * déclare, et reçoit alors une valeur éventuellement `undefined`.
     */
    readonly validateWhenEmpty?: boolean;

    private state: ValidatorState = makeState("pristine", []);
    private options: ValidationOptions = {};
    private readonly listeners = new Set<ValidatorListener>();
    /**
     * Canal distinct pour les demandes de revalidation.
     *
     * Un drapeau unique, consommé par le premier abonné réveillé, laissait les
     * suivants sans rien : un membre partagé entre deux champs n'en faisait
     * revalider qu'un. Chaque abonné a désormais son propre appel.
     */
    private readonly staleListeners = new Set<ValidatorListener>();
    /** Jeton de run monotone — un résultat périmé ne doit pas écraser un plus frais. */
    private run = 0;
    /** Statut d'avant l'entrée en `loading`, pour pouvoir y revenir. */
    private beforeLoading: ValidatorStatus = "pristine";
    /** Les constats d'avant l'entrée en `loading`, appariés au statut ci-dessus. */
    private beforeIssues: readonly ValidationIssue[] = [];

    /**
     * Les règles propres au champ. Les constats passent par `report` ; renvoyer
     * une promesse pour une règle asynchrone (le champ porte `loading` pendant
     * ce temps).
     *
     * `ctx` donne accès en lecture aux champs déclarés dans `watch`.
     */
    protected abstract validate(
        value: T,
        report: ValidationReport,
        ctx: ValidationContext,
    ): void | Promise<void>;

    setOptions(options: ValidationOptions): this {
        this.options = options;
        return this;
    }

    getState(): ValidatorState {
        return this.state;
    }

    subscribe(listener: ValidatorListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    async handle(value: T | undefined, ctx: ValidationContext = detachedContext()): Promise<ValidatorState> {
        const run = ++this.run;
        // Mémorisé avant la passe, et pas seulement à l'entrée en `loading` :
        // une passe purement synchrone peut être interrompue elle aussi.
        if (this.state.status !== "loading") {
            this.beforeLoading = this.state.status;
            this.beforeIssues = this.state.issues;
        }
        const report = new ValidationReport();
        const empty = this.isEmpty(value);

        if (this.options.required && empty) {
            report.error(this.options.requiredMessage ?? "This field is required", { code: "required" });
        }

        // Les deux ne s'excluent pas : une règle qui a demandé à se prononcer
        // sur du vide doit l'être même quand `required` a déjà parlé. C'est le
        // cas d'un constat serveur « ce champ manque », qui porterait sinon sur
        // la saisie suivante.
        const pending = this.runInto(value, report, ctx);
        if (pending instanceof Promise) {
            this.setState(makeState("loading", this.state.issues));
            try {
                await pending;
            } catch (error) {
                reportRuleFailure(this.constructor.name, error);
                report.fail();
                // Une règle qui casse — un réseau tombé — n'est pas un verdict.
                // Mais les règles qui ont **réussi** dans la même passe en ont
                // un : `required`, et tout membre synchrone d'un composite. Les
                // jeter revenait à contourner un champ obligatoire et à effacer
                // un constat serveur déjà posé.
                //
                // À une règle qui veut signaler son propre échec de le faire
                // explicitement, par `report.error(...)` ou `report.warn(...)`.
            }
        }

        if (run !== this.run) {
            return this.state;
        }

        this.publish(report);
        return this.state;
    }

    /**
     * Exécute les règles de ce validator dans un rapport **fourni**, sans
     * toucher à son propre état ni au sien de `required`.
     *
     * C'est ce que la composition appelle : le composite reste seul porteur de
     * l'état publié, et surtout un membre synchrone n'introduit pas de tour
     * asynchrone — sinon composer deux règles synchrones ferait clignoter
     * `loading` à chaque frappe.
     */
    runInto(
        value: T | undefined,
        report: ValidationReport,
        ctx: ValidationContext,
    ): void | Promise<void> {
        if (!this.isEmpty(value) || this.validateWhenEmpty === true) {
            return this.validate(value as T, report, ctx);
        }
        return undefined;
    }

    /**
     * Publie le résultat d'une passe.
     *
     * Un refus est toujours publié : il vient d'une règle qui a conclu. En
     * revanche, l'absence de refus dans une passe **interrompue** ne prouve
     * rien — on garde alors le dernier verdict connu plutôt que de déclarer
     * valide une valeur qu'aucune règle n'a pu juger.
     */
    private publish(report: ValidationReport): void {
        if (report.hasError) {
            this.setState(makeState("error", [...report.issues]));
            return;
        }
        if (report.interrupted) {
            this.setState(makeState(this.beforeLoading, this.beforeIssues));
            return;
        }
        this.setState(makeState("valid", [...report.issues]));
    }

    /**
     * Fait partir sans attendre une validation différée en cours.
     *
     * Sans effet ici : seuls les validators qui diffèrent leur exécution le
     * redéfinissent. Le FieldController l'appelle au blur et à la soumission,
     * pour ne jamais statuer sur une valeur périmée.
     */
    flush(): void {
        // no-op
    }

    /**
     * Signale que ce validator doit être **rejoué**, et pas seulement relu.
     *
     * Sert aux validators dont le verdict peut changer sans que la valeur
     * bouge : des issues injectées de l'extérieur, une règle qui dépend d'un
     * autre champ. Le FieldController relance alors une validation au lieu de
     * se contenter de republier l'état courant.
     */
    protected requestRevalidation(): void {
        for (const listener of this.staleListeners) {
            listener();
        }
    }

    /**
     * Abandonne une validation en vol : sort de `loading` en gardant le dernier
     * verdict, et invalide le run pour que son résultat tardif soit écarté.
     *
     * Sans ça, une règle dont la promesse ne retombe jamais laissait le champ
     * occupé et condamnait toutes les soumissions suivantes — le pendant côté
     * behavior était traité, celui-ci non.
     */
    abandon(): void {
        this.run += 1;
        if (this.state.status === "loading") {
            this.setState(makeState(this.beforeLoading, this.state.issues));
        }
    }

    /** S'abonner aux demandes de revalidation, indépendamment des changements d'état. */
    onStale(listener: ValidatorListener): () => void {
        this.staleListeners.add(listener);
        return () => {
            this.staleListeners.delete(listener);
        };
    }

    reset(): void {
        this.run += 1;
        this.setState(makeState("pristine", []));
    }

    get issues(): readonly ValidationIssue[] {
        return this.state.issues;
    }

    get errors(): readonly string[] {
        return errorsOf(this.state.issues);
    }

    get firstError(): string | null {
        return this.errors[0] ?? null;
    }

    get hasError(): boolean {
        return this.state.status === "error";
    }

    protected isEmpty(value?: T): boolean {
        if (value === undefined || value === null) {
            return true;
        }
        if (typeof value === "string") {
            return value.trim() === "";
        }
        if (Array.isArray(value)) {
            return value.length === 0;
        }
        // `false` n'est vide que si le champ l'a demandé : une case à cocher
        // obligatoire n'est pas la même chose qu'un booléen renseigné à faux.
        if (value === false) {
            return this.options.requiredTrue === true;
        }
        return false;
    }

    private setState(next: ValidatorState): void {
        if (next.status === this.state.status && sameIssues(next.issues, this.state.issues)) {
            return;
        }
        this.state = next;
        for (const listener of this.listeners) {
            listener();
        }
    }
}

function makeState(status: ValidatorStatus, issues: readonly ValidationIssue[]): ValidatorState {
    return { status, issues, errors: errorsOf(issues) };
}

/** Contexte de repli quand un validator est appelé hors d'un formulaire. */
function detachedContext(): ValidationContext {
    return {
        name: "<detached>",
        form: { name: "<detached>", status: "idle", field: () => null, values: () => ({}) },
        signal: new AbortController().signal,
        watched: () => null,
    };
}

/** Un échec de règle est signalé : l'avaler ferait d'un réseau tombé un silence. */
function reportRuleFailure(rule: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[slz] Validation rule "${rule}" failed: ${message}`, error);
}
