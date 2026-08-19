import {
    IValidator,
    type ValidationContext,
    type ValidationOptions,
    type ValidationReport,
} from "./IValidator";

/**
 * Fait tenir **N validators** sur un champ, chacun gardant ses propres règles.
 *
 * Le champ ne voit jamais cette classe : passer un tableau à `validator` suffit,
 * le FieldController enveloppe. C'est ce qui permet de composer une règle
 * métier et un porteur d'erreurs serveur sans que l'un connaisse l'autre.
 *
 * `required` n'est pas propagé aux membres : la classe de base le traite une
 * fois, ici, sinon le message serait signalé autant de fois qu'il y a de
 * membres.
 */
export class CompositeValidator<T = string> extends IValidator<T> {
    override readonly watch: readonly string[] | undefined;
    /**
     * Hérité des membres : si l'un d'eux veut se prononcer sur du vide, le
     * composite doit l'appeler. Sans ça, composer une règle lui retirait
     * silencieusement cette capacité.
     */
    override readonly validateWhenEmpty: boolean;

    private readonly members: readonly IValidator<T>[];
    private unsubscribes: (() => void)[] = [];

    constructor(members: readonly IValidator<T>[]) {
        super();
        this.members = members;

        const watched = [...new Set(members.flatMap((member) => member.watch ?? []))];
        this.watch = watched.length > 0 ? watched : undefined;
        this.validateWhenEmpty = members.some((member) => member.validateWhenEmpty === true);

        this.subscribeToMembers();
    }

    /**
     * Un membre qui se déclare périmé (constats injectés) rend le composite
     * périmé : la demande de revalidation doit remonter jusqu'au champ.
     *
     * Réétabli à la demande, parce qu'un membre peut être **partagé** entre
     * plusieurs champs : garder l'abonnement d'un champ détruit ferait grossir
     * sa liste d'auditeurs sans fin.
     */
    private subscribeToMembers(): void {
        if (this.unsubscribes.length > 0) {
            return;
        }
        for (const member of this.members) {
            this.unsubscribes.push(member.onStale(() => this.requestRevalidation()));
        }
    }

    /** Coupe les abonnements. Le prochain tour de validation les rétablit. */
    detach(): void {
        for (const unsubscribe of this.unsubscribes) {
            unsubscribe();
        }
        this.unsubscribes = [];
    }

    override setOptions(options: ValidationOptions): this {
        super.setOptions(options);
        return this;
    }

    /**
     * Point de passage garanti : `validate()` est sauté quand la valeur est
     * vide et qu'aucun membre ne réclame de se prononcer, alors que le
     * réabonnement, lui, doit avoir lieu à chaque tour.
     */
    override runInto(
        value: T | undefined,
        report: ValidationReport,
        ctx: ValidationContext,
    ): void | Promise<void> {
        this.subscribeToMembers();
        return super.runInto(value, report, ctx);
    }

    protected validate(value: T, report: ValidationReport, ctx: ValidationContext): void | Promise<void> {
        // Chaque membre écrit dans le rapport commun. Ceux qui sont synchrones
        // le font tout de suite : le composite ne devient asynchrone que si l'un
        // d'eux l'est réellement.
        const pending = this.members
            .map((member) => member.runInto(value, report, ctx))
            .filter((result): result is Promise<void> => result instanceof Promise);

        if (pending.length === 0) {
            return undefined;
        }
        return Promise.all(pending).then(() => undefined);
    }

    override flush(): void {
        for (const member of this.members) {
            member.flush();
        }
    }

    override reset(): void {
        for (const member of this.members) {
            member.reset();
        }
        super.reset();
    }

}
