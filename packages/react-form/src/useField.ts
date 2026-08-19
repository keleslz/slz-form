import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type {
    FieldController,
    FieldOption,
    FormController,
    IBehavior,
    IValidator,
    OptionValue,
    UiFlag,
    UiState,
    ValidationIssue,
} from "slz-form";

export interface UseFieldParams<V = string, M = never> {
    name: string;
    required?: boolean;
    requiredMessage?: string;
    initialValue?: V;
    /** Traite `false` comme vide — pour une case à cocher qui doit être cochée. */
    requiredTrue?: boolean;
    /** Un validator, ou plusieurs : leurs constats sont agrégés. */
    validator?: IValidator<V> | readonly IValidator<V>[];
    behaviors?: readonly IBehavior<V, M>[];
    options?: readonly FieldOption<OptionValue<V>, M>[];
    /**
     * À renseigner seulement quand le parent pilote la valeur.
     *
     * La **présence de la clé** fait foi, pas sa valeur : passer `value:
     * undefined` efface le champ, ne pas passer `value` du tout le laisse libre.
     */
    value?: V;
    /** Verrouillage décidé par la vue, cumulé avec celui des behaviors. */
    locked?: boolean;
    /** Lecture seule : lisible et sélectionnable, mais non modifiable. */
    readOnly?: boolean;
}

export interface UseFieldResult<V = string, M = never> {
    name: string;
    value: V | undefined;
    options: readonly FieldOption<OptionValue<V>, M>[];
    errors: readonly string[];
    error: string | undefined;
    /** Tous les constats, bloquants ou non — avec leur `code` pour les router. */
    issues: readonly ValidationIssue[];
    /** Les constats non bloquants. */
    warnings: readonly string[];
    ui: UiState;
    flags: readonly UiFlag[];
    hasFlag: (...flags: UiFlag[]) => boolean;
    isPristine: boolean;
    isValid: boolean;
    isLoading: boolean;
    isLocked: boolean;
    isReadOnly: boolean;
    isVisible: boolean;
    showError: boolean;
    touched: boolean;
    focused: boolean;
    required: boolean;
    submitting: boolean;
    onChange: (next: V | undefined) => void;
    onBlur: () => void;
    onFocus: () => void;
    controller: FieldController<V, M>;
}

/** Un formulaire dont la map de champs est inconnue d'ici. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyForm = FormController<any>;

/**
 * Implémentation partagée. Le point d'entrée public est `hooksFor(form)`, qui
 * la lie à un formulaire et contraint `name` à ses champs.
 *
 * C'est le seul endroit où le typage est relâché : `hooksFor` a déjà vérifié
 * que le nom appartient au formulaire et que les types concordent, mais cette
 * fonction ne voit plus la map. Le pont est ici, et nulle part ailleurs.
 */
export function useFieldOn<V, M>(
    form: AnyForm,
    params: UseFieldParams<V, M>,
): UseFieldResult<V, M> {
    const { name, required, value, locked, readOnly } = params;
    // La présence de la clé, pas sa valeur : sans ça, un champ non piloté se
    // ferait effacer par le `value: undefined` implicite à chaque mise à jour.
    const controlled = "value" in params;
    const options = params.options;

    const controller = useMemo(
        // `name` est élargi ici pour la même raison que `params` plus bas :
        // `hooksFor` a déjà vérifié qu'il appartient au formulaire, mais cette
        // fonction ne voit plus la map.
        () => form.field(name as never, {
            required: params.required,
            requiredMessage: params.requiredMessage,
            requiredTrue: params.requiredTrue,
            initialValue: params.initialValue,
            validator: params.validator,
            behaviors: params.behaviors,
            options: params.options,
        } as never) as FieldController<V, M>,
        // Identité seulement. Behaviors et validator sont lus à la création, donc
        // les passer en ligne depuis un rendu ne reconstruit jamais le champ.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [form, name],
    );

    const snapshot = useSyncExternalStore(controller.listen, controller.getSnapshot);

    useEffect(() => {
        controller.mount();
        return () => controller.unmount();
    }, [controller]);

    useEffect(() => {
        controller.update({
            required,
            locked,
            readOnly,
            ...(controlled ? { value } : {}),
            // Une liste statique poussée par le parent. Un champ alimenté par
            // `loadOptions` ne passe pas cette prop, donc rien ne l'écrase.
            ...(options !== undefined ? { options } : {}),
        } as never);
    }, [controller, required, value, controlled, locked, readOnly, options]);

    const onChange = useCallback((next: V | undefined) => controller.change(next), [controller]);
    const onBlur = useCallback(() => controller.blur(), [controller]);
    const onFocus = useCallback(() => controller.focus(), [controller]);
    const hasFlag = useCallback((...flags: UiFlag[]) => snapshot.ui.has(...flags), [snapshot]);

    return {
        name: snapshot.name,
        value: snapshot.value,
        options: snapshot.options,
        errors: snapshot.errors,
        error: snapshot.error,
        issues: snapshot.issues,
        warnings: snapshot.warnings,
        ui: snapshot.ui,
        flags: snapshot.ui.flags,
        hasFlag,
        isPristine: snapshot.isPristine,
        isValid: snapshot.isValid,
        isLoading: snapshot.isLoading,
        isLocked: snapshot.isLocked,
        isReadOnly: snapshot.isReadOnly,
        isVisible: snapshot.isVisible,
        showError: snapshot.showError,
        touched: snapshot.touched,
        focused: snapshot.focused,
        required: snapshot.required,
        submitting: snapshot.submitting,
        onChange,
        onBlur,
        onFocus,
        controller,
    };
}
