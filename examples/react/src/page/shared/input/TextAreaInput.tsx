export interface TextAreaInputProps {
    value: string;
    rows?: number;
    disabled?: boolean;
    onChange: (next: string) => void;
    onBlur?: () => void;
    onFocus?: () => void;
}

export function TextAreaInput(props: TextAreaInputProps) {
    const { value, rows = 3, disabled, onChange, onBlur, onFocus } = props;
    return (
        <textarea
            rows={rows}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            onFocus={onFocus}
        />
    );
}
