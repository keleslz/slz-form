import { TextField as MuiTextField, Stack, CircularProgress, InputAdornment } from "@mui/material";
import type { TextFieldProps } from "./props";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Controller } from "../../slz-lib-2/core/Controller";
import { formSlice, useAppDispatch, useAppSelector } from "../../redux";

export function TextFieldV2(props: TextFieldProps) {
    const dispatch = useAppDispatch()
    const existingField = useAppSelector((s) => s.forms[props.formId]?.fields[props.fieldId]);

    const controller = useMemo(() => new Controller({
        validator: props.validator,
        behaviors: props.behaviors,
        dispatch: (field) => {
            const status = field.validator?.getState().status;
            dispatch(formSlice.actions.updateField({
                formId: props.formId,
                fieldId: props.fieldId,
                value: field.value,
                status: status === "error" ? "error" : status === "valid" ? "valid" : "idle",
                errors: field.validator?.getErrors(),
            }));
        },
        field: {
            name: props.fieldId,
            initialValue: props.value ?? existingField?.value ?? "",
            required: props.required
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [props.formId, props.fieldId])

    const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

    useEffect(() => {
        controller.mount(props.value);
        return () => controller.unmount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controller]);

    const flags = snapshot.flags;
    const isLoading = flags.includes("loading");
    const showError = flags.includes("error");

    return <Stack spacing={2}>
        <MuiTextField
            label={props.label}
            placeholder={props.placeholder}
            variant="outlined"
            value={typeof snapshot.value === "string" ? snapshot.value : ""}
            onChange={(e) => controller.change(e.target.value)}
            onBlur={controller.blur}
            error={showError}
            helperText={showError ? controller.field.validator?.firstError : undefined}
            disabled={controller.form.isSubmit}
            slotProps={{
                input: {
                    endAdornment: isLoading ? (
                        <InputAdornment position="end"><CircularProgress size={20} /></InputAdornment>
                    ) : undefined,
                },
            }}
        />
    </Stack>;
}
