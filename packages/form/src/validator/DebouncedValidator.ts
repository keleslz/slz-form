import { createDebouncer, type Debouncer } from "../util/debounce";
import { IValidator, type ValidationContext, type ValidationReport } from "./IValidator";

/**
 * Décorateur qui **diffère** l'exécution d'un validator, sans rien changer à ses
 * règles. Pensé pour les validations qui touchent le réseau.
 *
 * ```ts
 * new DebouncedValidator(new UsernameValidator(), 400)
 * ```
 *
 * Ce que le décorateur garantit :
 *
 * - une seule exécution par salve de frappe — les fenêtres précédentes sont
 *   remplacées, et le jeton de run de la classe de base écarte leurs résultats ;
 * - le champ porte `loading` **dès la première frappe**, pendant l'attente comme
 *   pendant l'appel : `validate` renvoie une promesse, donc la base bascule
 *   l'état tout de suite ;
 * - `flush()` fait partir la validation en attente sans délai — le
 *   FieldController l'appelle au blur et à la soumission, pour ne jamais valider
 *   une valeur périmée.
 *
 * `required` n'est pas différé : il est traité par la classe de base avant que
 * les règles ne soient sollicitées. Un champ obligatoire vidé signale son erreur
 * immédiatement.
 */
export class DebouncedValidator<T = string> extends IValidator<T> {
    /**
     * Le `watch` du validator décoré, recopié. Assigné dans le constructeur et
     * non exposé par un getter : `watch` est un champ de la classe de base, et
     * un champ masque un accesseur de sous-classe.
     */
    override readonly watch: readonly string[] | undefined;
    /** Hérité aussi : le décorateur ne change rien aux règles qu'il diffère. */
    override readonly validateWhenEmpty: boolean | undefined;

    private readonly inner: IValidator<T>;
    private readonly delay: number;
    private readonly debouncer: Debouncer = createDebouncer();
    private unsubscribeInner: (() => void) | null = null;

    constructor(inner: IValidator<T>, delay: number) {
        super();
        this.inner = inner;
        this.delay = delay;
        this.watch = inner.watch;
        this.validateWhenEmpty = inner.validateWhenEmpty;

        this.listenInner();
    }

    /**
     * Le décorateur ne change rien aux règles qu'il diffère : une demande de
     * revalidation venue du validator décoré doit remonter jusqu'au champ,
     * sinon des constats injectés resteraient muets.
     *
     * Repris à chaque passe, et pas seulement à la construction : `detach()`
     * coupe l'abonnement quand le champ se démonte, et rien ne le rétablissait.
     * Un champ conditionnel masqué une fois — ou n'importe quel champ sous
     * `StrictMode`, qui monte, démonte et remonte — cessait définitivement de
     * recevoir les erreurs serveur d'un `ExternalValidator` différé. Le
     * composite se réabonne de la même façon, pour la même raison.
     */
    private listenInner(): void {
        if (this.unsubscribeInner) {
            return;
        }
        this.unsubscribeInner = this.inner.onStale(() => this.requestRevalidation());
    }

    protected async validate(value: T, report: ValidationReport, ctx: ValidationContext): Promise<void> {
        this.listenInner();
        if (!(await this.debouncer.wait(this.delay))) {
            // Remplacée par une frappe plus récente : ne rien signaler. Le jeton
            // de run de la base empêche de toute façon la publication.
            return;
        }

        // `runInto` et non `handle` : le décorateur écrit dans **le** rapport de
        // la passe, donc ce que la règle décorée lève ou rejette remonte tel
        // quel. Passer par `handle` faisait avaler l'échec par l'état interne
        // du validator décoré, et la passe se croyait complète.
        await this.inner.runInto(value, report, ctx);
    }

    override flush(): void {
        this.debouncer.flush();
        this.inner.flush();
    }

    /**
     * Coupe l'abonnement à la règle décorée — utile quand celle-ci est
     * partagée : sans ça, chaque décorateur créé laisserait un auditeur
     * derrière lui.
     */
    detach(): void {
        this.unsubscribeInner?.();
        this.unsubscribeInner = null;
    }

    override reset(): void {
        this.debouncer.cancel();
        this.inner.reset();
        super.reset();
    }
}
