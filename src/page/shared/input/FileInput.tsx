export interface FileInputProps {
    accept?: string;
    disabled?: boolean;
    onChange: (next: File | undefined) => void;
    onBlur?: () => void;
}

export function FileInput(props: FileInputProps) {
    const { accept, disabled, onChange, onBlur } = props;
    return (
        <input
            type="file"
            accept={accept}
            disabled={disabled}
            onChange={(event) => onChange(event.target.files?.[0])}
            onBlur={onBlur}
        />
    );
}
