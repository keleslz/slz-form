import { TextField as MuiTextField, Stack, CircularProgress, InputAdornment } from "@mui/material";
import type { TextFieldProps } from "./props";
import { useEffect, useMemo } from "react";
import { Controller } from "../../slz-lib-2/core/Controller";
import { formSlice, useAppDispatch, useAppSelector } from "../../redux";
import { useFieldSelector } from "../../slz-lib-2/react-core/hook/useFieldSelector";

export function TextFieldV2(props: TextFieldProps) {
    const dispatch = useAppDispatch()
    const field = useFieldSelector({
        fieldId: props.fieldId,
        formId: props.formId,
    })

    /**
     * TODO - Internalize registration logic in Controller. It should keep Form and Field state. The goal it's to minimize input and slice implementation to make it easily movable on other framework
     */
    const controller = useMemo(() => new Controller({
        validator: props.validator,
        behaviors: props.behaviors,
        field: {
            name: props.fieldId,
            initialValue: props.value,
            required: props.required
        },
    }), [props])

    useEffect(() => {
        controller.mount(props.value);
        return () => controller.unmount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controller]);

    const snapshot = controller.getSnapshot()

    return <Stack spacing={2}>
        <MuiTextField
            label={props.label}
            placeholder={props.placeholder}
            variant="outlined"
            value={snapshot.getValue() ?? undefined}
            onChange={(e) => controller.update(e.target.value)}
            onBlur={controller.onBlur}
            error={snapshot.hasFlags("error")}
            helperText={controller.getValidator()?.firstError}
            disabled={snapshot.hasFlags('loading')}
            slotProps={{
                input: {
                    endAdornment: snapshot.hasFlags("loading") ? (
                        <InputAdornment position="end"><CircularProgress size={20} /></InputAdornment>
                    ) : undefined,
                },
            }}
        />
    </Stack>;
}
