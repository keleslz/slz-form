import { useId } from "react";
import type { Option } from "../../../api/types";

export type TextKind = "text" | "email" | "tel" | "password";

export interface TextInputProps {
    kind?: TextKind;
    value: string;
    placeholder?: string;
    disabled?: boolean;
    onChange: (next: string) => void;
    onBlur?: () => void;
    onFocus?: () => void;
    /** Suggestions affichées par le navigateur, sans contraindre la saisie. */
    suggestions?: readonly Option[];
}

export function TextInput(props: TextInputProps) {
    const { kind = "text", value, placeholder, disabled, onChange, onBlur, onFocus, suggestions } = props;
    const listId = useId();
    const hasSuggestions = suggestions !== undefined && suggestions.length > 0;

    return (
        <>
            <input
                type={kind}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                list={hasSuggestions ? listId : undefined}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                onFocus={onFocus}
            />
            {hasSuggestions && (
                <datalist id={listId} data-testid="suggestions">
                    {suggestions.map((option) => (
                        <option key={option.value} value={option.value} />
                    ))}
                </datalist>
            )}
        </>
    );
}
