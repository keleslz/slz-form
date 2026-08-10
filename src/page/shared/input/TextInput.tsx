export type TextKind = "text" | "email" | "tel" | "password";

export interface TextInputProps {
    kind?: TextKind;
    value: string;
    placeholder?: string;
    disabled?: boolean;
    onChange: (next: string) => void;
    onBlur?: () => void;
    onFocus?: () => void;
}

export function TextInput(props: TextInputProps) {
    const { kind = "text", value, placeholder, disabled, onChange, onBlur, onFocus } = props;
    return (
        <input
            type={kind}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            onFocus={onFocus}
        />
    );
}
