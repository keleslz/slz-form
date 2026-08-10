import { IValidator, type ValidationReport } from "slz-form";
import { validateFile, type Rule } from "../../validation";

export class FileValidator extends IValidator<File> {
    private readonly rule: Rule<File>;

    constructor(maxBytes: number, accepted: readonly string[]) {
        super();
        this.rule = validateFile(maxBytes, accepted);
    }

    protected validate(value: File, report: ValidationReport): void {
        const error = this.rule(value);
        if (error) {
            report.error(error);
        }
    }
}
