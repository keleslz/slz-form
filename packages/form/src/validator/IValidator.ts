export type ValidatorStatus = "pristine" | "loading" | "valid" | "error";

export interface ValidatorState {
    readonly status: ValidatorStatus;
    readonly errors: readonly string[];
}

export interface ValidationOptions {
    required?: boolean;
    requiredMessage?: string;
}

export type ValidatorListener = () => void;

/**
 * Error collector handed to `validate`, scoped to a **single run**.
 *
 * Errors are never accumulated on the validator instance: two concurrent async
 * validations would otherwise interleave their messages.
 */
export class ValidationReport {
    private readonly messages: string[] = [];

    error(message: string): this {
        this.messages.push(message);
        return this;
    }

    errorIf(invalid: boolean, message: string): this {
        if (invalid) {
            this.messages.push(message);
        }
        return this;
    }

    get errors(): readonly string[] {
        return this.messages;
    }

    get hasError(): boolean {
        return this.messages.length > 0;
    }
}

/**
 * Validity authority for one field (invariant 13). Generic over the value type,
 * so the same contract covers text, options, multi-options, files, dates,
 * times and datetimes — subclass with the `T` you need.
 *
 * Behaviors never decide validity; they only react to it.
 */
export abstract class IValidator<T = string> {
    private state: ValidatorState = { status: "pristine", errors: [] };
    private options: ValidationOptions = {};
    private readonly listeners = new Set<ValidatorListener>();
    /** Monotonic run id — a stale async run must not overwrite a fresher result. */
    private run = 0;

    /**
     * Implement the field-specific rules. Push messages through `report`;
     * return a promise for async rules (the field shows `loading` meanwhile).
     */
    protected abstract validate(value: T, report: ValidationReport): void | Promise<void>;

    setOptions(options: ValidationOptions): this {
        this.options = options;
        return this;
    }

    getState(): ValidatorState {
        return this.state;
    }

    subscribe(listener: ValidatorListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    async handle(value?: T): Promise<ValidatorState> {
        const run = ++this.run;
        const report = new ValidationReport();
        const empty = this.isEmpty(value);

        if (this.options.required && empty) {
            report.error(this.options.requiredMessage ?? "This field is required");
        } else if (!empty) {
            const pending = this.validate(value as T, report);
            if (pending instanceof Promise) {
                this.setState({ status: "loading", errors: this.state.errors });
                await pending;
            }
        }

        if (run !== this.run) {
            return this.state;
        }

        this.setState(report.hasError
            ? { status: "error", errors: [...report.errors] }
            : { status: "valid", errors: [] });

        return this.state;
    }

    reset(): void {
        this.run += 1;
        this.setState({ status: "pristine", errors: [] });
    }

    get errors(): readonly string[] {
        return this.state.errors;
    }

    get firstError(): string | null {
        return this.state.errors[0] ?? null;
    }

    get hasError(): boolean {
        return this.state.status === "error";
    }

    protected isEmpty(value?: T): boolean {
        if (value === undefined || value === null) {
            return true;
        }
        if (typeof value === "string") {
            return value.trim() === "";
        }
        if (Array.isArray(value)) {
            return value.length === 0;
        }
        return false;
    }

    private setState(next: ValidatorState): void {
        if (next.status === this.state.status && sameErrors(next.errors, this.state.errors)) {
            return;
        }
        this.state = next;
        for (const listener of this.listeners) {
            listener();
        }
    }
}

function sameErrors(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((message, i) => message === b[i]);
}
