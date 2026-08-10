import { IValidator, type ValidationReport } from "../../slz-lib-v5/core";
import { validateConsent } from "../../validation";

export class ConsentValidator extends IValidator<boolean> {
    protected validate(value: boolean, report: ValidationReport): void {
        const error = validateConsent(value);
        if (error) {
            report.error(error);
        }
    }
}
