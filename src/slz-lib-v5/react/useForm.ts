import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { FormController, FormSnapshot } from "../core";
import { useFormRegister } from "./registerContext";

export interface UseFormResult {
    form: FormController;
    snapshot: FormSnapshot;
    values: Readonly<Record<string, unknown>>;
    errors: Readonly<Record<string, readonly string[]>>;
    isValid: boolean;
    isSubmitting: boolean;
    submit: () => Promise<boolean>;
    reset: () => void;
}

/**
 * Form-level subscription — for a submit button, a summary, a debug panel.
 *
 * Opt-in on purpose: a Field never calls this, so a change on one field never
 * re-renders the others (invariants 11, 22). The Form is *mounted* here but
 * never unmounted: it lives at module scope and outlives any component that
 * happens to read it.
 */
export function useForm(name: string): UseFormResult {
    const register = useFormRegister();
    const form = useMemo(() => register.require(name), [register, name]);

    const snapshot = useSyncExternalStore(form.listen, form.getSnapshot);

    useEffect(() => {
        form.mount();
    }, [form]);

    const submit = useCallback(() => form.submit(), [form]);
    const reset = useCallback(() => {
        form.reset();
    }, [form]);

    return {
        form,
        snapshot,
        values: snapshot.values,
        errors: snapshot.errors,
        isValid: snapshot.isValid,
        isSubmitting: snapshot.isSubmitting,
        submit,
        reset,
    };
}
