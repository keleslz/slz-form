export interface CheckboxInputProps {
    checked: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
    onBlur?: () => void;
}

export function CheckboxInput(props: CheckboxInputProps) {
    const { checked, disabled, onChange, onBlur } = props;
    return (
        <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            onBlur={onBlur}
        />
    );
}
