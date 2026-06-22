import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { hasField, hasFieldError, type FieldState, type FormState } from "../../core";
import type { FieldValue } from "../../../slz-lib-2/core/ui/FieldValue";

/**
 * Fo = form id type, Fi = field id type. Both are string unions.
 * Inside reducers, `state` is typed as `Draft<FormState<T>>` by Immer.
 * When `T` is generic, `Draft<Record<T, ...>>` cannot be indexed by `T` — this is
 * a known TypeScript/Immer limitation. We cast `state` to `FormState<string>` internally
 * to work around this. The public API (actions, selectors) remains typed with `T`.
 */
export const createFormSlice = <Fo extends string, Fi extends FieldValue>(name: string, initialState = {} as FormState<Fo, Fi>) => {
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
                    console.error("Form not found")
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
                    console.error("Form not found")
                    return;
                }

                form.status = { value: "submitted" };
            },
            /**
             * Upsert a field: creates the form and/or the field when they don't
             * exist yet, otherwise updates the existing field in place. Replaces
             * the former register/update split.
             */
            updateField: (state, action: PayloadAction<{
                formId: Fo;
                fieldId: Fi;
                value: FieldValue;
                status: "idle" | "valid" | "error";
                errors?: string[];
            }>) => {
                const s = state as FormState<string, string>;
                const { formId, fieldId, value, status, errors } = action.payload;
                const fieldStatus = status === "error"
                    ? { value: "error" as const, errors: errors || [] }
                    : { value: status };

                let form = s[formId];
                if (!form) {
                    form = {
                        id: formId,
                        name: formId,
                        status: status === "error" ? { value: "error", errors: [] } : { value: "idle" },
                        fields: {},
                    };
                    s[formId] = form;
                }

                const field = form.fields[fieldId];
                if (!field) {
                    form.fields[fieldId] = { id: fieldId, value, status: fieldStatus };
                } else {
                    field.value = value;
                    field.status = fieldStatus;
                }

                if (hasFieldError(form)) {
                    form.status = { value: "error", errors: errors || [] };
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
                if (!form) {
                    console.error('Form not found')
                    return;
                }
                if (!hasField(form)) {
                    console.error("No field referenced")
                    return;
                }
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
                    console.error("Form not found")
                    return;
                }

                form.status = { value: "error", errors: [] };
            },
            resetForm: () => initialState
        },
    })
}