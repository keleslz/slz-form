export interface NumberInputProps {
    value: number | undefined;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    onChange: (next: number | undefined) => void;
    onBlur?: () => void;
    onFocus?: () => void;
}

export function NumberInput(props: NumberInputProps) {
    const { value, min, max, step, disabled, onChange, onBlur, onFocus } = props;
    return (
        <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value ?? ""}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.valueAsNumber)}
            onBlur={onBlur}
            onFocus={onFocus}
        />
    );
}
