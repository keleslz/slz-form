import { isPlateAvailable } from "../../api/check-plate-availability";
import { IValidator, type ValidationReport } from "../../slz-lib-v5/core";
import { PLATE_TAKEN, validatePlateFormat } from "../../validation";

/** Async: the field carries `loading` on the activity axis while this resolves. */
export class PlateValidator extends IValidator<string> {
    protected async validate(value: string, report: ValidationReport): Promise<void> {
        const format = validatePlateFormat(value);
        if (format) {
            report.error(format);
            return;
        }
        if (!(await isPlateAvailable(value.toUpperCase()))) {
            report.error(PLATE_TAKEN);
        }
    }
}
