import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { FieldArrayRow, FieldsShape, FormController } from "slz-form";

export interface UseFieldArrayResult<TRow extends FieldsShape> {
    /** Les lignes dans l'ordre affiché. `row.id` est une clé React stable. */
    rows: readonly FieldArrayRow<TRow>[];
    append: () => string;
    remove: (id: string) => void;
    move: (from: number, to: number) => void;
    clear: () => void;
}

/** Un formulaire dont la map de champs est inconnue d'ici. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyForm = FormController<any>;

/**
 * Implémentation partagée. Le point d'entrée public est `hooksFor(form)`, qui
 * la lie à un formulaire et contraint `name` à ses listes.
 *
 * Le composant ne se re-rend que lorsque la **composition** de la liste change
 * — ajout, retrait, déplacement. Le contenu d'une ligne a ses propres abonnés,
 * donc taper dans une ligne ne re-rend pas les autres.
 */
export function useFieldArrayOn<TRow extends FieldsShape>(
    form: AnyForm,
    name: string,
): UseFieldArrayResult<TRow> {
    const controller = useMemo(
        // `name` est élargi pour la même raison que dans `useField` : `hooksFor`
        // a déjà vérifié qu'il désigne une liste du formulaire.
        () => form.array(name as never) as unknown as {
            rows: readonly FieldArrayRow<TRow>[];
            append: () => string;
            remove: (id: string) => void;
            move: (from: number, to: number) => void;
            clear: () => void;
            mount: () => void;
            unmount: () => void;
            listen: (listener: () => void) => () => void;
            getSnapshot: () => readonly FieldArrayRow<TRow>[];
        },
        [form, name],
    );

    const rows = useSyncExternalStore(controller.listen, controller.getSnapshot);

    useEffect(() => {
        controller.mount();
        return () => controller.unmount();
    }, [controller]);

    const append = useCallback(() => controller.append(), [controller]);
    const remove = useCallback((id: string) => controller.remove(id), [controller]);
    const move = useCallback((from: number, to: number) => controller.move(from, to), [controller]);
    const clear = useCallback(() => controller.clear(), [controller]);

    return { rows, append, remove, move, clear };
}
