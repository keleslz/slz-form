import { TextField as MuiTextField, Stack, CircularProgress, InputAdornment } from "@mui/material";
import type { TextFieldProps } from "./props";
import { useTextField } from "./useTextField";

export function TextField(props: TextFieldProps) {
    const controller = useTextField(props);

    return <Stack spacing={2}>
        <MuiTextField
            label={props.label}
            placeholder={props.placeholder}
            variant="outlined"
            value={controller.field?.value ?? ""}
            onChange={(e) => controller.onChange(e.target.value)}
            onBlur={controller.onBlur}
            error={controller.showError}
            helperText={controller.showError ? controller.errorMessage : undefined}
            disabled={controller.isSubmitting}
            slotProps={{
                input: {
                    // `readOnly` (not `disabled`) keeps the input focusable while
                    // the field is locked — avoids losing focus on every loading flip.
                    readOnly: controller.isLocked,
                    endAdornment: controller.isLoading ? (
                        <InputAdornment position="end"><CircularProgress size={20} /></InputAdornment>
                    ) : undefined,
                },
            }}
        />
    </Stack>;
}
