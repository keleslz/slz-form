import { IValidator, type ValidationIssue, type ValidationReport } from "./IValidator";

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
 * Les constats sont **effacés dès que la valeur change** : une erreur serveur
 * porte sur la valeur qui a été envoyée, pas sur celle que l'utilisateur est en
 * train de corriger.
 */
export class ExternalValidator<T = string> extends IValidator<T> {
    private stored: readonly ValidationIssue[] = [];
    private boundTo: T | undefined;
    private bound = false;

    /** Publie des constats et demande une revalidation du champ. */
    set(issues: readonly ValidationIssue[]): void {
        this.stored = issues;
        this.bound = false;
        this.requestRevalidation();
    }

    clear(): void {
        if (this.stored.length === 0) {
            return;
        }
        this.stored = [];
        this.bound = false;
        this.requestRevalidation();
    }

    protected validate(value: T, report: ValidationReport): void {
        if (this.stored.length === 0) {
            return;
        }

        if (!this.bound) {
            // Première exécution après `set` : les constats se lient à la valeur
            // qui était en place au moment de l'appel serveur.
            this.boundTo = value;
            this.bound = true;
        } else if (!Object.is(value, this.boundTo)) {
            this.stored = [];
            return;
        }

        report.add(this.stored);
    }
}
