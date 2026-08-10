import type { Option } from "../../../api/types";

export interface MultiSelectInputProps {
    value: readonly string[];
    options: readonly Option[];
    size?: number;
    disabled?: boolean;
    onChange: (next: string[]) => void;
    onBlur?: () => void;
    onFocus?: () => void;
}

export function MultiSelectInput(props: MultiSelectInputProps) {
    const { value, options, size = 4, disabled, onChange, onBlur, onFocus } = props;
    return (
        <select
            multiple
            size={size}
            value={value as string[]}
            disabled={disabled}
            onChange={(event) => onChange(Array.from(event.target.selectedOptions, (o) => o.value))}
            onBlur={onBlur}
            onFocus={onFocus}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}
