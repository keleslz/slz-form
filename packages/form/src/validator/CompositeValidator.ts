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

    constructor(members: readonly IValidator<T>[]) {
        super();
        this.members = members;

        const watched = [...new Set(members.flatMap((member) => member.watch ?? []))];
        this.watch = watched.length > 0 ? watched : undefined;
        this.validateWhenEmpty = members.some((member) => member.validateWhenEmpty === true);

        // Un membre qui se déclare périmé (issues injectées) rend le composite
        // périmé : la demande de revalidation doit remonter jusqu'au champ.
        //
        // L'abonnement vit aussi longtemps que le composite, qui possède ses
        // membres. Le couper au démontage le rendait définitif — un cycle
        // démontage/remontage, que React fait en StrictMode, laissait les
        // erreurs serveur muettes.
        for (const member of members) {
            member.subscribe(() => {
                if (member.consumeStale()) {
                    this.requestRevalidation();
                }
            });
        }
    }

    override setOptions(options: ValidationOptions): this {
        super.setOptions(options);
        return this;
    }

    protected async validate(value: T, report: ValidationReport, ctx: ValidationContext): Promise<void> {
        const states = await Promise.all(this.members.map((member) => member.handle(value, ctx)));
        for (const state of states) {
            report.add(state.issues);
        }
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
