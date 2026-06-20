import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { UseFieldProps } from "./props";
import { toFieldStatus } from "./toFieldStatus";
import { toVerdict } from "./toVerdict";
import { formSlice, useAppDispatch, useAppSelector } from "../../../../../redux";
import { DefaultBehavior, FieldController, getFormFieldById, type FieldState, type UIFlag } from "../../../../core";

export type FieldStatus = FieldState<string>["status"];

/**
 * Thin React/Redux adapter on top of `FieldController`. The controller owns
 * the per-field state machine; this hook only bridges:
 *   React lifecycle ↔ controller.mount/unmount/change/blur
 *   Redux form slice  ↔ controller snapshot
 */
export function useField(props: UseFieldProps) {
    const { formId, fieldId, validator, value, required, behaviors } = props;
    const dispatch = useAppDispatch();
    const formStatus = useAppSelector((s) => s.form[formId]?.status);
    const existingField = useAppSelector((s) => getFormFieldById(s.form[formId], fieldId));

    const controller = useMemo(
        () => new FieldController({
            validator,
            behaviors: behaviors && behaviors.length > 0 ? behaviors : [new DefaultBehavior()],
            options: { name: fieldId, initialValue: value ?? existingField?.value ?? "", required },
        }),
        // Recreate only on identity change. Other prop changes are pushed via setters below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [formId, fieldId],
    );

    const snap = useSyncExternalStore(
        (cb) => controller.subscribe(cb),
        () => controller.getSnapshot(),
    );

    // mount/unmount + initial registerField
    useEffect(() => {
        controller.mount();
        const initial = controller.getSnapshot();
        dispatch(formSlice.actions.registerField({
            formId,
            field: {
                id: fieldId,
                value: initial.value,
                status: toFieldStatus(initial.validatorStatus, initial.errors),
            },
        }));
        return () => controller.unmount();
    }, [controller, dispatch, formId, fieldId]);

    // external `value` prop (controlled-by-parent case)
    useEffect(() => {
        if (value !== undefined) {
            controller.change(value);
        }
    }, [value, controller]);

    // `required` prop changes
    useEffect(() => { controller.setRequired(required); }, [required, controller]);

    // bridge form-level submitting status into the controller
    useEffect(() => {
        const submitting = formStatus?.value === "submitting";
        controller.setSubmitting(submitting);
        if (submitting) controller.submit();
    }, [formStatus?.value, controller]);

    // reflect snapshot changes into Redux
    useEffect(() => {
        dispatch(formSlice.actions.updateField({
            formId,
            fieldId,
            value: snap.value,
            status: toVerdict({
                status: snap.validatorStatus,
                errors: snap.errors,
            }),
            errors: snap.errors,
        }));
    }, [snap.value, snap.validatorStatus, snap.errors.length, dispatch, formId, fieldId]);

    const hasFlag = (f: UIFlag) => snap.flags.includes(f);

    return {
        field: {
            id: fieldId,
            value: snap.value,
            status: toFieldStatus(snap.validatorStatus, snap.errors),
        },
        flags: snap.flags,
        isPristine: hasFlag("pristine"),
        isLoading: hasFlag("loading"),
        isLocked: hasFlag("locked"),
        showError: hasFlag("error"),
        errorMessage: hasFlag("error") ? validator?.getFirstError() ?? undefined : undefined,
        isSubmitting: snap.submitting,
        onChange: (v: string) => controller.change(v),
        onBlur: () => controller.blur(),
    };
}