import type { ReactNode } from "react";
import { countRender } from "./renderCounter";

export interface FieldShellProps {
    /** Unique across the whole page — used to key the render counter. */
    id: string;
    label: string;
    hint?: string;
    required?: boolean;
    showError?: boolean;
    error?: string;
    isLoading?: boolean;
    /** Live UI flags. Only the engine-driven implementation has any. */
    badges?: readonly string[];
    children: ReactNode;
}

/**
 * Shared by both implementations, on purpose: identical markup on each side
 * means the comparison isolates state management, nothing else.
 *
 * Presentational only — it owns no state.
 */
export function FieldShell(props: FieldShellProps) {
    const { id, label, hint, required, showError, error, isLoading, badges = [], children } = props;
    const renders = countRender(id);

    return (
        <div className={`field${showError ? " field--error" : ""}`}>
            <div className="field__head">
                <label className="field__label">
                    {label}
                    {required && <span className="field__required"> *</span>}
                </label>
                <span className="field__flags">
                    {badges.map((badge) => (
                        <span key={badge} className={`chip chip--${badge}`}>{badge}</span>
                    ))}
                    <span className="chip chip--renders" title="rendus de ce champ">↻ {renders}</span>
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
