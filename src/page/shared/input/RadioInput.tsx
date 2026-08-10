import type { Option } from "../../../api/types";

export interface RadioInputProps {
    name: string;
    value: string;
    options: readonly Option[];
    disabled?: boolean;
    onChange: (next: string) => void;
    onBlur?: () => void;
}

export function RadioInput(props: RadioInputProps) {
    const { name, value, options, disabled, onChange, onBlur } = props;
    return (
        <div className="radio-group">
            {options.map((option) => (
                <label key={option.value} className="radio">
                    <input
                        type="radio"
                        name={name}
                        value={option.value}
                        checked={value === option.value}
                        disabled={disabled || option.disabled}
                        onChange={() => onChange(option.value)}
                        onBlur={onBlur}
                    />
                    {option.label}
                </label>
            ))}
        </div>
    );
}
