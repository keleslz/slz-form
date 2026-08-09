import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type {
    FieldController,
    FieldOption,
    IBehavior,
    IValidator,
    UiFlag,
    UiState,
} from "../core";
import { useFormRegister } from "./registerContext";

export interface UseFieldParams<T = string> {
    /** Name of the form to join, as registered in the FormRegister. */
    form: string;
    name: string;
    required?: boolean;
    requiredMessage?: string;
    initialValue?: T;
    validator?: IValidator<T>;
    behaviors?: readonly IBehavior<T>[];
    options?: readonly FieldOption[];
    /** Set only when the parent drives the value; leave out otherwise. */
    value?: T;
}

export interface UseFieldResult<T = string> {
    name: string;
    value: T | undefined;
    options: readonly FieldOption[];
    errors: readonly string[];
    error: string | undefined;
    ui: UiState;
    flags: readonly UiFlag[];
    hasFlag: (...flags: UiFlag[]) => boolean;
    isPristine: boolean;
    isValid: boolean;
    isLoading: boolean;
    isLocked: boolean;
    isVisible: boolean;
    showError: boolean;
    touched: boolean;
    focused: boolean;
    required: boolean;
    submitting: boolean;
    onChange: (next: T | undefined) => void;
    onBlur: () => void;
    onFocus: () => void;
    controller: FieldController<T>;
}

/**
 * Joins a field to its form and bridges it to React.
 *
 * The field is created on first render and reused afterwards, so adding an
 * input to a form is a single call — nothing to declare in the form module.
 * All the hook does is wire React's lifecycle to the controller and read its
 * snapshot: no `useState` mirrors the controller's state (invariants 3, 4, 15).
 */
export function useField<T = string>(params: UseFieldParams<T>): UseFieldResult<T> {
    const { form: formName, name, required, value } = params;
    const register = useFormRegister();
    const form = useMemo(() => register.require(formName), [register, formName]);

    const controller = useMemo(
        () => form.field<T>(name, {
            required: params.required,
            requiredMessage: params.requiredMessage,
            initialValue: params.initialValue,
            validator: params.validator,
            behaviors: params.behaviors,
            options: params.options,
        }),
        // Identity only. Behaviors and validator are read at creation, so
        // passing them inline from a render never rebuilds the field.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [form, name],
    );

    const snapshot = useSyncExternalStore(controller.listen, controller.getSnapshot);

    useEffect(() => {
        controller.mount();
        return () => controller.unmount();
    }, [controller]);

    useEffect(() => {
        controller.update({ required, value });
    }, [controller, required, value]);

    const onChange = useCallback((next: T | undefined) => controller.change(next), [controller]);
    const onBlur = useCallback(() => controller.blur(), [controller]);
    const onFocus = useCallback(() => controller.focus(), [controller]);
    const hasFlag = useCallback((...flags: UiFlag[]) => snapshot.ui.has(...flags), [snapshot]);

    return {
        name: snapshot.name,
        value: snapshot.value,
        options: snapshot.options,
        errors: snapshot.errors,
        error: snapshot.error,
        ui: snapshot.ui,
        flags: snapshot.ui.flags,
        hasFlag,
        isPristine: snapshot.isPristine,
        isValid: snapshot.isValid,
        isLoading: snapshot.isLoading,
        isLocked: snapshot.isLocked,
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
