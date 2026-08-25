import type { FormFlag } from "./FormFlag";
import type { UiState } from "../state";
import type { FormStatus } from "./FormView";

/** Un champ, vu du formulaire : ses flags et ses données. */
export interface FieldSummary {
    readonly name: string;
    readonly value: unknown;
    readonly ui: UiState;
    /**
     * Les constats bloquants. `errors` vide **est** le verdict « ce champ ne
     * bloque pas » — le flag `error`, lui, dit seulement ce qu'on affiche.
     */
    readonly errors: readonly string[];
}

/** Une liste de lignes, vue du formulaire parent. */
export interface ArraySummary {
    readonly name: string;
    readonly ui: UiState;
    readonly values: readonly Readonly<Record<string, unknown>>[];
    /** Les constats bloquants de toutes ses lignes, à plat. */
    readonly errors: readonly string[];
}

/**
 * The form's state at an instant T — an aggregate over its fields, kept
 * deliberately thin (invariant 21).
 *
 * Comme un champ : des **flags**, lus par `hasFlag` / `hasAny`, et des
 * **données**. Aucun booléen d'état (invariant 32).
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
     * ET — le formulaire porte **tous** ces flags.
     *
     * ```tsx
     * <button disabled={!form.hasFlag("valid", "idle")}>Envoyer</button>
     * ```
     */
    hasFlag(...flags: FormFlag[]): boolean {
        return flags.every((flag) => this.holds(flag));
    }

    /** OU — le formulaire porte **au moins un** de ces flags. */
    hasAny(...flags: FormFlag[]): boolean {
        return flags.some((flag) => this.holds(flag));
    }

    /** Projection à plat — débogage, rendu de l'état brut. */
    get flags(): readonly FormFlag[] {
        const flags: FormFlag[] = [this.validity, this.status];
        if (this.isLoading) {
            flags.push("loading");
        }
        if (this.isTouched) {
            flags.push("touched");
        }
        return flags;
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
        for (const rows of this.arrays) {
            if (rows.errors.length > 0) {
                errors[rows.name] = rows.errors;
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

    /**
     * Le verdict, pas l'affichage.
     *
     * Comptent seuls les champs **montés et visibles** : un champ démonté ou
     * masqué ne fait pas partie du formulaire qu'on remplit. Sans ça, un champ
     * conditionnel obligatoire mais invisible rendait la soumission impossible
     * sans que l'utilisateur puisse rien y faire.
     *
     * Le critère est `errors`, pas le flag `error` du champ : un formulaire
     * prérempli et correct est valide même si personne n'a encore rien touché
     * (arbitrage 24).
     */
    private get validity(): FormValidity {
        const clean = this.contributing.every((field) => field.errors.length === 0)
            && this.arrays.every((rows) => rows.errors.length === 0);
        return clean ? "valid" : "error";
    }

    /** Les champs qui pèsent sur la validité et sur le payload. */
    private get contributing(): readonly FieldSummary[] {
        return this.fields.filter((field) => field.ui.hasFlag("mounted") && !field.ui.hasFlag("invisible"));
    }

    /**
     * Tous les champs, pas seulement ceux qui comptent.
     *
     * « Masqué vaut absent » (invariant 29) vaut pour la **validité et le
     * payload** : un champ conditionnel ne doit pas condamner la soumission.
     * Son travail asynchrone, lui, est bien réel et `submit()` l'attend — d'où
     * le même périmètre que `FormController.isBusy`. Filtrer ici déclarait le
     * formulaire au repos pendant qu'il attendait jusqu'à `settleTimeout`.
     */
    private get isLoading(): boolean {
        return this.fields.some((field) => field.ui.hasFlag("loading"))
            || this.arrays.some((rows) => rows.ui.hasFlag("loading"));
    }

    private get isTouched(): boolean {
        return this.fields.some((field) => field.ui.hasFlag("touched"));
    }

    private holds(flag: FormFlag): boolean {
        switch (flag) {
            case "valid":
            case "error":
                return this.validity === flag;
            case "loading":
                return this.isLoading;
            case "touched":
                return this.isTouched;
            default:
                return this.status === flag;
        }
    }
}

type FormValidity = "valid" | "error";

function sameSummary(a: FieldSummary, b: FieldSummary | undefined): boolean {
    return b !== undefined
        && a.name === b.name
        && Object.is(a.value, b.value)
        && a.ui.equals(b.ui)
        && sameMessages(a.errors, b.errors);
}

function sameArray(a: ArraySummary, b: ArraySummary | undefined): boolean {
    return b !== undefined
        && a.name === b.name
        && a.ui.equals(b.ui)
        && sameMessages(a.errors, b.errors)
        && a.values.length === b.values.length
        && a.values.every((row, i) => sameRow(row, b.values[i]));
}

function sameMessages(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((message, i) => message === b[i]);
}

function sameRow(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>> | undefined): boolean {
    if (b === undefined) {
        return false;
    }
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length
        && keys.every((key) => Object.is(a[key], b[key]));
}
