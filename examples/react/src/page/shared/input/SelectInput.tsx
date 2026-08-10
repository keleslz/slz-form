import type { Option } from "../../../api/types";

export interface SelectInputProps {
    value: string;
    options: readonly Option[];
    placeholder?: string;
    disabled?: boolean;
    onChange: (next: string | undefined) => void;
    onBlur?: () => void;
    onFocus?: () => void;
}

export function SelectInput(props: SelectInputProps) {
    const { value, options, placeholder = "—", disabled, onChange, onBlur, onFocus } = props;
    return (
        <select
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value || undefined)}
            onBlur={onBlur}
            onFocus={onFocus}
        >
            <option value="">{placeholder}</option>
            {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}
