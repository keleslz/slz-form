import { useField } from "../../slz-lib";
import type { TextFieldProps } from "./props";

/**
 * Text-field-specific wrapper around `useField`. Currently a thin pass-through
 * — exists for symmetry with `useSelectField` and as a single place to add
 * future text-specific bridging (e.g. masking, formatting, IME handling).
 */
export function useTextField(props: TextFieldProps) {
    return useField({
        formId: props.formId,
        fieldId: props.name,
        name: props.name,
        validator: props.validator,
        behaviors: props.behaviors,
        value: props.value,
        required: props.required,
    });
}
