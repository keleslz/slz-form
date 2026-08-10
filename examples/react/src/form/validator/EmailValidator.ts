import { IValidator, type ValidationReport } from "slz-form";
import { validateEmail } from "../../validation";

export class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        const error = validateEmail(value);
        if (error) {
            report.error(error);
        }
    }
}
