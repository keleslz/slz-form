import { IValidator, type ValidationReport } from "slz-form";
import { validateTimeWindow, type Rule } from "../../validation";

export class TimeWindowValidator extends IValidator<string> {
    private readonly rule: Rule<string>;

    constructor(fromHour: number, toHour: number) {
        super();
        this.rule = validateTimeWindow(fromHour, toHour);
    }

    protected validate(value: string, report: ValidationReport): void {
        const error = this.rule(value);
        if (error) {
            report.error(error);
        }
    }
}
