import { IValidator, type ValidationReport } from "../../slz-lib-v5/core";
import { validateMaxSelection, type Rule } from "../../validation";

export class SelectionCountValidator extends IValidator<string[]> {
    private readonly rule: Rule<string[]>;

    constructor(max: number) {
        super();
        this.rule = validateMaxSelection(max);
    }

    protected validate(value: string[], report: ValidationReport): void {
        const error = this.rule(value);
        if (error) {
            report.error(error);
        }
    }
}
