import { FormControl, InputLabel, MenuItem, Select, FormHelperText, Stack, CircularProgress } from "@mui/material";
import type { SelectFieldProps } from "./props";
import { useSelectField } from "./useSelectField";

export function SelectField(props: SelectFieldProps) {
    const controller = useSelectField(props);

    if (!controller.field) return null;

    const labelId = `select-${props.name}-label`;
    const disabled = controller.isSubmitting || controller.isLocked;

    return <Stack spacing={2}>
        <FormControl variant="outlined" error={controller.showError} disabled={disabled}>
            <InputLabel id={labelId}>{props.label}</InputLabel>
            <Select
                labelId={labelId}
                value={controller.field.value}
                onChange={(e) => controller.onChange(e.target.value)}
                onBlur={controller.onBlur}
                label={props.label}
                disabled={disabled}
                IconComponent={controller.isLoading
                    ? (iconProps) => <CircularProgress size={20} sx={{ mr: 1.5 }} {...iconProps} />
                    : undefined}
            >
                {controller.options.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                        {option.label}
                    </MenuItem>
                ))}
            </Select>
            {controller.showError && <FormHelperText>{controller.errorMessage}</FormHelperText>}
        </FormControl>
    </Stack>
}
