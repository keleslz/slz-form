import { IValidator, type ValidationReport } from "slz-form";
import { validateRange, type Rule } from "../../validation";

export class NumberRangeValidator extends IValidator<number> {
    private readonly rule: Rule<number>;

    constructor(min: number, max: number) {
        super();
        this.rule = validateRange(min, max);
    }

    protected validate(value: number, report: ValidationReport): void {
        const error = this.rule(value);
        if (error) {
            report.error(error);
        }
    }
}
