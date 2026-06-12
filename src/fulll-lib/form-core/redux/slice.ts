import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { hasField, hasFieldError } from "../util";
import type { FieldState, FormState } from "../util/state";

/**
 * Fo = form id type, Fi = field id type. Both are string unions.
 * Inside reducers, `state` is typed as `Draft<FormState<T>>` by Immer.
 * When `T` is generic, `Draft<Record<T, ...>>` cannot be indexed by `T` — this is
 * a known TypeScript/Immer limitation. We cast `state` to `FormState<string>` internally
 * to work around this. The public API (actions, selectors) remains typed with `T`.
 */
export const createFormSlice = <Fo extends string, Fi extends string>(name: string, initialState = {} as FormState<Fo, Fi>) => {
    return createSlice({
        name: name,
        initialState,
        reducers: {
            submitting: (state, action: PayloadAction<{
                formId: Fo;
            }>) => {
                const s = state as FormState<string, string>;
                const { formId } = action.payload;
                const form = s[formId];
                if (!form) {
                    return;
                }

                form.status = { value: "submitting" };
            },
            submitted: (state, action: PayloadAction<{
                formId: Fo;
            }>) => {
                const s = state as FormState<string, string>;
                const { formId } = action.payload;
                const form = s[formId];
                if (!form) {
                    return;
                }

                form.status = { value: "submitted" };
            },
            updateField: (state, action: PayloadAction<{
                formId: Fo;
                fieldId: Fi;
                value: string;
                status: "idle" | "valid" | "error";
                errors?: string[];
            }>) => {
                const s = state as FormState<string, string>;
                const { formId, fieldId, value, status, errors } = action.payload;
                const form = s[formId];

                if (!form) {
                    return;
                }

                if (!hasField(form)) {
                    return;
                }

                const field = form.fields[fieldId];
                if (!field) {
                    return;
                }

                field.value = value;
                field.status = status === "error" ? { value: "error", errors: errors || [] } : { value: status };
                const hasError = hasFieldError(form);
                if (hasError) {
                    form.status = { value: "error", errors: errors || [] };
                    return;
                }
            },
            updateFieldStatus: (state, action: PayloadAction<{
                formId: Fo;
                fieldId: Fi;
                status: FieldState<Fi>["status"]["value"];
                errors?: string[];
            }>) => {
                const s = state as FormState<string, string>;
                const { formId, fieldId, status, errors } = action.payload;
                const form = s[formId];
                if (!form || !hasField(form)) return;
                const field = form.fields[fieldId];
                if (!field) return;
                if (field.status.value === status) {
                    return;
                }
                field.status = status === "error" ?
                    { value: "error", errors: errors ?? [] }
                    : { value: status };
                if (hasFieldError(form)) {
                    form.status = { value: "error", errors: errors ?? [] };
                }
            },
            registerField: (state, action: PayloadAction<{
                formId: Fo;
                field: FieldState<Fi>;
                errors?: string[];
            }>) => {
                const s = state as FormState<string, string>;
                const { formId, field } = action.payload;
                if (!s[formId]) {
                    s[formId] = {
                        id: formId,
                        name: formId,
                        status: field.status.value === "error" ? { value: "error", errors: [] } : { value: "idle" },
                        fields: {
                            [field.id]: field
                        }
                    };
                    return;
                }
                s[formId].fields[field.id] = field;
            },
            unregisterField: (state, action: PayloadAction<{
                formId: Fo;
                fieldId: Fi;
            }>) => {
                const s = state as FormState<string, string>;
                const { formId, fieldId } = action.payload;
                if (!s[formId]) {
                    return;
                }

                delete s[formId].fields[fieldId];
            },
            error(state, action: PayloadAction<{
                formId: Fo;
            }>) {
                const s = state as FormState<Fo, Fi>;
                const { formId } = action.payload;
                const form = s[formId];
                if (!form) {
                    return;
                }

                form.status = { value: "error", errors: [] };
            },
            resetForm: () => initialState
        },
    })
}