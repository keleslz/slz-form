import { useCallback, useEffect, useSyncExternalStore } from "react";
import type {
    AnyFormFlag,
    ArrayNameOf,
    FieldsShape,
    FormController,
    FormFlag,
    FormSnapshot,
    MetaOf,
    ValueOf,
} from "slz-form";
import type { RowOf } from "slz-form";
import { useFieldOn, type UseFieldParams, type UseFieldResult } from "./useField";
import { useFieldArrayOn, type UseFieldArrayResult } from "./useFieldArray";

/**
 * Ce qu'un formulaire rend — mêmes règles qu'un champ : des flags, des données,
 * des actions.
 *
 * ```tsx
 * <button disabled={!form.hasFlag("valid", "idle")}>Envoyer</button>
 * ```
 */
export interface UseFormResult {
    snapshot: FormSnapshot;
    values: Readonly<Record<string, unknown>>;
    errors: Readonly<Record<string, readonly string[]>>;
    flags: readonly FormFlag[];
    /** ET — le formulaire porte **tous** ces flags. */
    hasFlag: (...flags: AnyFormFlag[]) => boolean;
    /** OU — le formulaire porte **au moins un** de ces flags. */
    hasAny: (...flags: AnyFormFlag[]) => boolean;
    submit: () => Promise<boolean>;
    reset: () => void;
}

/**
 * Les hooks d'un formulaire, liés à sa map de champs.
 *
 * ```ts
 * export const { useField, useForm } = hooksFor(carForm);
 * ```
 *
 * `name` est contraint aux champs déclarés, la valeur et le meta sont inférés,
 * et le formulaire n'a plus à être nommé à chaque appel — plus de `form={FORM}`
 * répété sur chaque champ de la vue.
 *
 * Aucun provider n'est nécessaire pour ce chemin : le formulaire est capturé
 * ici. `FormProvider` et `useFormRegister` restent disponibles pour l'accès
 * transverse à tous les formulaires de l'application.
 */
export function hooksFor<TFields extends FieldsShape>(form: FormController<TFields>) {
    type Name = Extract<keyof TFields, string>;

    function useField<K extends Name>(
        params: { name: K } & Omit<
            UseFieldParams<ValueOf<TFields[K]>, MetaOf<TFields[K]>>,
            "name"
        >,
    ): UseFieldResult<ValueOf<TFields[K]>, MetaOf<TFields[K]>> {
        return useFieldOn<ValueOf<TFields[K]>, MetaOf<TFields[K]>>(form, params);
    }

    /**
     * Les lignes d'une liste répétable. `name` est contraint aux listes
     * déclarées par la map — un nom de champ simple ne compile pas.
     */
    function useFieldArray<K extends ArrayNameOf<TFields>>(
        name: K,
    ): UseFieldArrayResult<RowOf<TFields[K]>> {
        return useFieldArrayOn<RowOf<TFields[K]>>(form, name);
    }

    /**
     * Souscription au formulaire entier — bouton de soumission, récapitulatif.
     * Un champ ne l'appelle jamais, c'est ce qui préserve l'isolation des rendus.
     */
    function useForm(): UseFormResult {
        const snapshot = useSyncExternalStore(form.listen, form.getSnapshot);

        useEffect(() => {
            form.mount();
        }, []);

        const submit = useCallback(() => form.submit(), []);
        const reset = useCallback(() => {
            form.reset();
        }, []);
        const hasFlag = useCallback(
            (...flags: AnyFormFlag[]) => snapshot.hasFlag(...flags),
            [snapshot],
        );
        const hasAny = useCallback(
            (...flags: AnyFormFlag[]) => snapshot.hasAny(...flags),
            [snapshot],
        );

        return {
            snapshot,
            values: snapshot.values,
            errors: snapshot.errors,
            flags: snapshot.flags,
            hasFlag,
            hasAny,
            submit,
            reset,
        };
    }

    return { useField, useFieldArray, useForm };
}
