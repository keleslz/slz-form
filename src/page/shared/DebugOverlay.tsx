import { useState, type ReactNode } from "react";

export interface DebugOverlayProps {
    title: string;
    children: ReactNode;
}

/**
 * Right-hand drawer, collapsed by default, opened by its toggle.
 *
 * Kept out of the form's grid so the forms themselves stay side by side and the
 * inspector never steals horizontal space.
 */
export function DebugOverlay({ title, children }: DebugOverlayProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className={`overlay__toggle${open ? " is-open" : ""}`}
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
            >
                {open ? "✕" : "🛠"} <span>{open ? "Fermer" : "Debugger"}</span>
            </button>

            <aside className={`overlay${open ? " is-open" : ""}`} aria-hidden={!open}>
                <header className="overlay__head">
                    <h2>{title}</h2>
                </header>
                <div className="overlay__body">{children}</div>
            </aside>
        </>
    );
}
