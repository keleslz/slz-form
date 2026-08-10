export type DateKind = "date" | "time" | "datetime-local";

export interface DateInputProps {
    kind: DateKind;
    value: string;
    disabled?: boolean;
    onChange: (next: string) => void;
    onBlur?: () => void;
    onFocus?: () => void;
}

export function DateInput(props: DateInputProps) {
    const { kind, value, disabled, onChange, onBlur, onFocus } = props;
    return (
        <input
            type={kind}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            onFocus={onFocus}
        />
    );
}
