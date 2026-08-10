import { IValidator, type ValidationReport } from "slz-form";
import { validateFutureDate } from "../../validation";

export class NotInThePastValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        const error = validateFutureDate(value);
        if (error) {
            report.error(error);
        }
    }
}
