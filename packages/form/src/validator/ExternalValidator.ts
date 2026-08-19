import {
    IValidator,
    type ValidationContext,
    type ValidationIssue,
    type ValidationReport,
} from "./IValidator";

/**
 * Porte des constats venus **de l'extérieur** : la réponse 422 d'un POST, un
 * moteur de règles distant, une vérification faite ailleurs.
 *
 * C'est un validator, donc l'invariant 13 tient : la validité reste décidée par
 * un validator, jamais par un behavior ni par la vue.
 *
 * ```ts
 * const serverIssues = new ExternalValidator<string>();
 * form.field("email", { validator: [new EmailValidator(), serverIssues] });
 *
 * // après un 422
 * serverIssues.set([{ message: "Déjà pris", severity: "error", code: "taken" }]);
 * ```
 *
 * Les constats sont **effacés dès que la valeur change**, et ne reviennent pas
 * tant que le serveur n'a pas répondu de nouveau.
 *
 * Précision utile : la liaison se fait à la première validation **qui suit**
 * `set()`, pas au moment de l'appel réseau. Si l'utilisateur tape pendant que
 * la requête est en vol, le constat se rattache à ce qu'il vient de saisir.
 */
export class ExternalValidator<T = string> extends IValidator<T> {
    /**
     * « Le serveur dit que ce champ manque » est le cas central d'un 422 : les
     * constats injectés doivent pouvoir porter sur une valeur vide.
     */
    override readonly validateWhenEmpty = true;

    private stored: readonly ValidationIssue[] = [];
    /**
     * La valeur à laquelle les constats se sont liés, **par champ**.
     *
     * Une instance peut être portée par plusieurs champs — c'est le cas d'un
     * membre de composite partagé. Une liaison unique faisait que le second
     * champ, dont la valeur diffère, effaçait les constats du premier.
     */
    private readonly boundTo = new Map<string, T | undefined>();
    /**
     * Les champs dont la valeur a changé depuis le `set`.
     *
     * Sans cet ensemble, supprimer la seule liaison libérait le champ pour un
     * tour puis le reliait au tour suivant — donc à la valeur corrigée. Le
     * constat ressuscitait à la soumission, et le formulaire ne pouvait plus
     * jamais être soumis.
     */
    private readonly released = new Set<string>();

    /** Publie des constats et demande une revalidation du champ. */
    set(issues: readonly ValidationIssue[]): void {
        this.stored = issues;
        this.boundTo.clear();
        this.released.clear();
        this.requestRevalidation();
    }

    clear(): void {
        if (this.stored.length === 0) {
            return;
        }
        this.stored = [];
        this.boundTo.clear();
        this.released.clear();
        this.requestRevalidation();
    }

    /** Une remise à zéro efface aussi les constats injectés. */
    override reset(): void {
        const carried = this.stored.length > 0;
        this.stored = [];
        this.boundTo.clear();
        this.released.clear();
        super.reset();
        // Une instance peut être portée par plusieurs champs : sans ça, les
        // autres restaient sur un instantané périmé, erreur affichée comprise.
        if (carried) {
            this.requestRevalidation();
        }
    }

    protected validate(value: T, report: ValidationReport, ctx: ValidationContext): void {
        if (this.stored.length === 0) {
            return;
        }

        const key = `${ctx.form.name}.${ctx.name}`;

        // Déjà corrigé : ce champ ne porte plus le constat, et ne le reprendra
        // pas tant que le serveur n'aura pas répondu de nouveau.
        if (this.released.has(key)) {
            return;
        }

        if (!this.boundTo.has(key)) {
            // Première exécution après `set` pour ce champ : les constats se
            // lient à la valeur qui était en place au moment de l'appel serveur.
            this.boundTo.set(key, value);
        } else if (!Object.is(value, this.boundTo.get(key))) {
            // Ce champ a été corrigé : il cesse de porter le constat, sans
            // toucher aux autres champs qui portent la même instance.
            this.boundTo.delete(key);
            this.released.add(key);
            return;
        }

        report.add(this.stored);
    }
}
