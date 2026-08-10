import { isUsernameAvailable } from "../../api/check-username-availability";
import { IValidator, type ValidationReport } from "slz-form";
import { USERNAME_TAKEN, validateUsernameFormat } from "../../validation";

/**
 * Règle asynchrone : le format d'abord, l'appel réseau seulement s'il passe.
 *
 * Le champ l'enveloppe dans un `DebouncedValidator` — le validator lui-même
 * ignore tout du délai, il ne connaît que ses règles.
 */
export class UsernameValidator extends IValidator<string> {
    protected async validate(value: string, report: ValidationReport): Promise<void> {
        const format = validateUsernameFormat(value);
        if (format) {
            report.error(format);
            return;
        }
        if (!(await isUsernameAvailable(value))) {
            report.error(USERNAME_TAKEN);
        }
    }
}
