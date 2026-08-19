import type { ValidityFlag } from "../state";
import type { FormStatus } from "./FormView";

export interface FieldSummary {
    readonly name: string;
    readonly value: unknown;
    /** Ce qu'on affiche — `pristine` tant que le champ n'a pas été touché. */
    readonly validity: ValidityFlag;
    readonly errors: readonly string[];
    /** Le verdict, indépendant de l'interaction : c'est lui qui décide de `isValid`. */
    readonly blocking: boolean;
    readonly visible: boolean;
    readonly mounted: boolean;
}

/** L'état d'une liste de lignes, vu du formulaire parent. */
export interface ArraySummary {
    readonly name: string;
    readonly valid: boolean;
    readonly values: readonly Readonly<Record<string, unknown>>[];
}

/**
 * The form's state at an instant T — an aggregate over its fields, kept
 * deliberately thin (invariant 21).
 *
 * Consuming it is opt-in: subscribing here means "I care about the whole form"
 * (a submit button, a debug panel). Fields never read it, so a change on one
 * field does not re-render the others (invariants 11, 22).
 */
export class FormSnapshot {
    readonly name: string;
    readonly status: FormStatus;
    readonly fields: readonly FieldSummary[];
    readonly arrays: readonly ArraySummary[];

    constructor(
        name: string,
        status: FormStatus,
        fields: readonly FieldSummary[],
        arrays: readonly ArraySummary[] = [],
    ) {
        this.name = name;
        this.status = status;
        this.fields = fields;
        this.arrays = arrays;
    }

    /**
     * Comptent seuls les champs **montés et visibles** : un champ démonté ou
     * masqué ne fait pas partie du formulaire qu'on remplit. Sans ça, un champ
     * conditionnel obligatoire mais invisible rendait la soumission impossible
     * sans que l'utilisateur puisse rien y faire.
     *
     * Le critère est `blocking`, pas `validity` : un formulaire prérempli et
     * correct est valide même si personne n'a encore touché à ses champs.
     */
    get isValid(): boolean {
        return this.contributing.every((field) => !field.blocking)
            && this.arrays.every((rows) => rows.valid);
    }

    /** Les champs qui pèsent sur la validité et sur le payload. */
    private get contributing(): readonly FieldSummary[] {
        return this.fields.filter((field) => field.mounted && field.visible);
    }

    get isSubmitting(): boolean {
        return this.status === "submitting";
    }

    get values(): Readonly<Record<string, unknown>> {
        const values: Record<string, unknown> = {};
        for (const field of this.contributing) {
            values[field.name] = field.value;
        }
        for (const rows of this.arrays) {
            values[rows.name] = rows.values;
        }
        return values;
    }

    get errors(): Readonly<Record<string, readonly string[]>> {
        const errors: Record<string, readonly string[]> = {};
        for (const field of this.contributing) {
            if (field.errors.length > 0) {
                errors[field.name] = field.errors;
            }
        }
        return errors;
    }

    field(name: string): FieldSummary | null {
        return this.fields.find((field) => field.name === name) ?? null;
    }

    equals(other: FormSnapshot): boolean {
        return this.name === other.name
            && this.status === other.status
            && this.fields.length === other.fields.length
            && this.fields.every((field, i) => sameSummary(field, other.fields[i]))
            && this.arrays.length === other.arrays.length
            && this.arrays.every((rows, i) => sameArray(rows, other.arrays[i]));
    }
}

function sameSummary(a: FieldSummary, b: FieldSummary | undefined): boolean {
    return b !== undefined
        && a.name === b.name
        && Object.is(a.value, b.value)
        && a.validity === b.validity
        && a.blocking === b.blocking
        && a.visible === b.visible
        && a.mounted === b.mounted
        && a.errors.length === b.errors.length
        && a.errors.every((message, i) => message === b.errors[i]);
}

function sameArray(a: ArraySummary, b: ArraySummary | undefined): boolean {
    return b !== undefined
        && a.name === b.name
        && a.valid === b.valid
        && a.values.length === b.values.length
        && a.values.every((row, i) => sameRow(row, b.values[i]));
}

function sameRow(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>> | undefined): boolean {
    if (b === undefined) {
        return false;
    }
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length
        && keys.every((key) => Object.is(a[key], b[key]));
}
