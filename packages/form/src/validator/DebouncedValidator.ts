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

    constructor(inner: IValidator<T>, delay: number) {
        super();
        this.inner = inner;
        this.delay = delay;
        this.watch = inner.watch;
        this.validateWhenEmpty = inner.validateWhenEmpty;
    }

    protected async validate(value: T, report: ValidationReport, ctx: ValidationContext): Promise<void> {
        if (!(await this.debouncer.wait(this.delay))) {
            // Remplacée par une frappe plus récente : ne rien signaler. Le jeton
            // de run de la base empêche de toute façon la publication.
            return;
        }

        const state = await this.inner.handle(value, ctx);
        report.add(state.issues);
    }

    override flush(): void {
        this.debouncer.flush();
        this.inner.flush();
    }

    override reset(): void {
        this.debouncer.cancel();
        this.inner.reset();
        super.reset();
    }
}
