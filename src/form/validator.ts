import { IValidator, type ValidationReport } from "../slz-lib-v5/core";
import { isPlateAvailable } from "./api";

/**
 * One validator per data shape. `IValidator<T>` being generic is what lets the
 * same contract cover text, numbers, booleans, option lists, files and dates —
 * each subclass validates its own `T`, with no cast anywhere.
 */

export class EmailValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        report.errorIf(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), "Adresse email invalide");
    }
}

/** Async: the field shows `loading` on the activity axis while this resolves. */
export class PlateValidator extends IValidator<string> {
    protected async validate(value: string, report: ValidationReport): Promise<void> {
        const normalized = value.toUpperCase();
        report.errorIf(
            !/^[A-Z]{2}-\d{3}-[A-Z]{2}$/.test(normalized),
            "Format attendu : AB-123-CD",
        );
        if (report.hasError) {
            return;
        }
        report.errorIf(!(await isPlateAvailable(normalized)), "Cette plaque est déjà enregistrée");
    }
}

export class NumberRangeValidator extends IValidator<number> {
    private readonly min: number;
    private readonly max: number;

    constructor(min: number, max: number) {
        super();
        this.min = min;
        this.max = max;
    }

    protected validate(value: number, report: ValidationReport): void {
        report
            .errorIf(Number.isNaN(value), "Valeur numérique attendue")
            .errorIf(value < this.min, `Minimum ${this.min}`)
            .errorIf(value > this.max, `Maximum ${this.max}`);
    }
}

export class SelectionCountValidator extends IValidator<string[]> {
    private readonly max: number;

    constructor(max: number) {
        super();
        this.max = max;
    }

    protected validate(value: string[], report: ValidationReport): void {
        report.errorIf(value.length > this.max, `${this.max} options maximum`);
    }
}

/**
 * `required` alone cannot express "must be checked": `false` is a value, not an
 * absence. The rule belongs to the validator, which is the validity authority.
 */
export class ConsentValidator extends IValidator<boolean> {
    protected validate(value: boolean, report: ValidationReport): void {
        report.errorIf(!value, "Vous devez accepter les conditions");
    }
}

export class FileValidator extends IValidator<File> {
    private readonly maxBytes: number;
    private readonly accepted: readonly string[];

    constructor(maxBytes: number, accepted: readonly string[]) {
        super();
        this.maxBytes = maxBytes;
        this.accepted = accepted;
    }

    protected validate(value: File, report: ValidationReport): void {
        report
            .errorIf(value.size > this.maxBytes, `Fichier trop volumineux (max ${Math.round(this.maxBytes / 1024)} Ko)`)
            .errorIf(!this.accepted.includes(value.type), `Formats acceptés : ${this.accepted.join(", ")}`);
    }
}

/** Works for `date`, `time` and `datetime-local`: the input hands back an ISO-ish string. */
export class NotInThePastValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        const parsed = new Date(value);
        report
            .errorIf(Number.isNaN(parsed.getTime()), "Date invalide")
            .errorIf(parsed.getTime() < Date.now(), "La date doit être dans le futur");
    }
}

export class TimeWindowValidator extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        const [hours] = value.split(":").map(Number);
        report.errorIf(hours < 8 || hours >= 19, "Créneau entre 08:00 et 19:00");
    }
}
