import type { FieldsShape } from "../field/Field";
import type { FormController } from "../form/FormController";

/**
 * Une ligne : un identifiant stable et le formulaire qui la porte.
 *
 * L'identifiant ne change **jamais** — ni à la suppression d'une autre ligne,
 * ni au réordonnancement. C'est ce qui permet de déplacer des lignes sans
 * renommer quoi que ce soit, et ce qui donne à React une clé fiable.
 */
export class FieldArrayRow<TRow extends FieldsShape> {
    readonly id: string;
    readonly form: FormController<TRow>;

    constructor(id: string, form: FormController<TRow>) {
        this.id = id;
        this.form = form;
    }

    /** Délégation : une ligne s'utilise exactement comme un formulaire. */
    get field(): FormController<TRow>["field"] {
        return this.form.field.bind(this.form);
    }

    get snapshot(): ReturnType<FormController<TRow>["getSnapshot"]> {
        return this.form.snapshot;
    }

    values(): Readonly<Record<string, unknown>> {
        return this.form.values();
    }
}
