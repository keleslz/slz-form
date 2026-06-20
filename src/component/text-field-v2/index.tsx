import { TextField as MuiTextField, Stack, CircularProgress, InputAdornment } from "@mui/material";
import type { TextFieldProps } from "./props";
import { useEffect, useMemo } from "react";
import { Controller } from "../../slz-lib-2/core/Controller";
import { useAppSelector } from "../../redux";
// import { getFormFieldById } from "../../slz-lib-2/core/util";

export function TextFieldV2(props: TextFieldProps) {
    const existingField = useAppSelector((s) => s.forms[props.formId]?.fields[props.fieldId]);

    const controller = useMemo(() => new Controller({
        validator: props.validator,
        behaviors: props.behaviors,
        field: {
            name: props.fieldId,
            initialValue: props.value ?? existingField?.value ?? "",
            required: props.required,
        },
    }), [props.formId, props.fieldId])

    /**
     *     const snap = useSyncExternalStore(
             (cb) => controller.subscribe(cb),
             () => controller.getSnapshot(),
         );
     */

    // mount/unmount + initial registerField
    useEffect(() => {
        controller.lifecycle.mount();
    }, [])

    useEffect(() => {
        const value = props.value
        if (value !== undefined) {
            console.log()
        }
    })
    // return <Stack spacing={2}>
    //     <MuiTextField
    //         label={props.label}
    //         placeholder={props.placeholder}
    //         variant="outlined"
    //         value={controller.field?.value ?? ""}
    //         onChange={(e) => controller.onChange(e.target.value)}
    //         onBlur={controller.onBlur}
    //         error={controller.showError}
    //         helperText={controller.showError ? controller.errorMessage : undefined}
    //         disabled={controller.isSubmitting}
    //         slotProps={{
    //             input: {
    //                 // `readOnly` (not `disabled`) keeps the input focusable while
    //                 // the field is locked — avoids losing focus on every loading flip.
    //                 readOnly: controller.isLocked,
    //                 endAdornment: controller.isLoading ? (
    //                     <InputAdornment position="end"><CircularProgress size={20} /></InputAdornment>
    //                 ) : undefined,
    //             },
    //         }}
    //     />
    // </Stack>;
}
