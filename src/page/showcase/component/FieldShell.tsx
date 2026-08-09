import type { ReactNode } from "react";
import type { UiFlag } from "../../../slz-lib-v5/core";
import { countRender } from "../renderCounter";

export interface FieldShellProps {
    label: string;
    hint?: string;
    required: boolean;
    showError: boolean;
    error?: string;
    isLoading: boolean;
    flags: readonly UiFlag[];
    children: ReactNode;
}

/**
 * Presentational only. It renders from the flags it is handed and owns no
 * business state whatsoever (invariants 15, 19).
 */
export function FieldShell(props: FieldShellProps) {
    const { label, hint, required, showError, error, isLoading, flags, children } = props;

    const renderCount = countRender(label);

    return (
        <div className={`field${showError ? " field--error" : ""}`}>
            <div className="field__head">
                <label className="field__label">
                    {label}
                    {required && <span className="field__required"> *</span>}
                </label>
                <span className="field__flags">
                    {flags.map((flag) => (
                        <span key={flag} className={`chip chip--${flag}`}>{flag}</span>
                    ))}
                    <span className="chip chip--renders" title="rendus de ce champ">↻ {renderCount}</span>
                </span>
            </div>

            <div className="field__control">
                {children}
                {isLoading && <span className="field__spinner" aria-label="chargement" />}
            </div>

            {showError
                ? <p className="field__error">{error}</p>
                : hint && <p className="field__hint">{hint}</p>}
        </div>
    );
}
