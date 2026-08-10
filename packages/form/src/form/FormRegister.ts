import type { FormController } from "./FormController";
import type { FormSnapshot } from "./FormSnapshot";

type Listener = () => void;

export interface FormRegisterParams {
    values: readonly FormController[];
}

/**
 * The single place that knows every form of the consuming app.
 *
 * Same role as a root reducer: each form is declared in its own contextual
 * module, and they are gathered here once. Nothing else imports a form
 * instance — views address forms by name through this register, which is what
 * keeps `new FormController(...)` from leaking into every component.
 *
 * Instantiable at module level: it holds no framework state.
 */
export class FormRegister {
    private readonly forms = new Map<string, FormController>();
    private readonly listeners = new Set<Listener>();
    private readonly unsubscribes: (() => void)[] = [];

    constructor(params: FormRegisterParams) {
        for (const form of params.values) {
            if (this.forms.has(form.name)) {
                throw new Error(`[slz] Duplicate form name "${form.name}" in the register.`);
            }
            this.forms.set(form.name, form);
            this.unsubscribes.push(form.listen(() => this.emit()));
        }
    }

    get(name: string): FormController | null {
        return this.forms.get(name) ?? null;
    }

    /** Same as `get`, but fails loudly — a typo in a form name is a wiring bug. */
    require(name: string): FormController {
        const form = this.forms.get(name);
        if (!form) {
            throw new Error(
                `[slz] Unknown form "${name}". Registered: ${this.names().join(", ") || "(none)"}.`,
            );
        }
        return form;
    }

    all(): readonly FormController[] {
        return [...this.forms.values()];
    }

    names(): readonly string[] {
        return [...this.forms.keys()];
    }

    /** State of every form at an instant T. */
    snapshots(): readonly FormSnapshot[] {
        return this.all().map((form) => form.snapshot);
    }

    /** Opt-in, app-wide: for a devtool or a debug panel, never for a field. */
    listen = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    dispose(): void {
        for (const unsubscribe of this.unsubscribes) {
            unsubscribe();
        }
        this.unsubscribes.length = 0;
        this.listeners.clear();
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}
