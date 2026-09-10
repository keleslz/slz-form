import { EngineGuardError } from "../error/EngineError";
import {
    IValidator,
    type ValidationContext,
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
        const pending: Promise<void>[] = [];

        for (const member of this.members) {
            // Chaque membre est isolé : celui qui casse ne doit ni interrompre
            // les suivants, ni faire disparaître ce qu'un autre a déjà écrit,
            // ni laisser une promesse orpheline derrière lui.
            try {
                const result = member.runInto(value, report, this.contextFor(member, ctx));
                if (result instanceof Promise) {
                    pending.push(result.catch((error: unknown) => {
                        // Routé vers le formulaire par le sink porté par `ctx`,
                        // jamais journalisé (invariant 38).
                        ctx.reportFailure?.(member.constructor.name, error);
                        report.fail();
                    }));
                }
            } catch (error) {
                ctx.reportFailure?.(member.constructor.name, error);
                report.fail();
            }
        }

        if (pending.length === 0) {
            return undefined;
        }
        // Aucune des promesses ne rejette : on attend donc bien **tous** les
        // membres, y compris ceux qui étaient encore en vol au moment de l'échec.
        return Promise.all(pending).then(() => undefined);
    }

    /**
     * Le contexte d'un membre, restreint à **son** `watch`.
     *
     * Le composite déclare l'union des dépendances de ses membres ; lui passer
     * tel quel dispenserait chacun de déclarer ce qu'il lit, et ferait tomber
     * les invariants 7 et 23 sur le chemin même que la doc recommande.
     */
    private contextFor(member: IValidator<T>, ctx: ValidationContext): ValidationContext {
        const declared = member.watch ?? [];

        return {
            name: ctx.name,
            get form() {
                return ctx.form;
            },
            get signal() {
                return ctx.signal;
            },
            watched: (name) => {
                if (!declared.includes(name)) {
                    // Garde du moteur : erreur typée, classée `guard-violation`
                    // au site du catch.
                    throw new EngineGuardError(
                        `[slz] Validator on "${ctx.name}" reads "${name}" without declaring it in \`watch\`.`,
                    );
                }
                return ctx.watched(name);
            },
            // Le sink traverse jusqu'au membre : un membre lui-même composite ou
            // différé route son échec au même point.
            reportFailure: ctx.reportFailure,
        };
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
