export type ValidationOption = {
    required?: boolean;
}

export type ValidatorState = { status: "idle" | "loading" | "valid" } | { status: "error", errors: string[] };
export type ValidatorListener = () => void;

export abstract class IValidator<T> {
    private value?: T;
    private errors: Map<number, string | null> = new Map();
    private options?: ValidationOption;
    private state: ValidatorState = { status: "idle" };
    private listeners: Set<ValidatorListener> = new Set();

    public setOptions(options: ValidationOption) {
        this.options = options;
        return this;
    }

    public getState(): ValidatorState {
        return this.state;
    }

    protected setState(state: ValidatorState): void {
        if (this.state === state) {
            return;
        }
        this.state = state;
        this.notify();
    }

    public subscribe(listener: ValidatorListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        this.listeners.forEach(l => l());
    }

    public hasError(): boolean {
        return Array.from(this.errors.values()).some(v => v !== null);
    }

    public getErrors(): string[] {
        return Array.from(this.errors.values()).filter((e): e is string => e !== null);
    }

    public getFirstError(): string | null {
        for (const e of this.errors.values()) if (e !== null) return e;
        return null;
    }

    public addError(invalid: boolean, message: string): void;
    public addError(message: string): void;
    public addError(invalidOrMessage: boolean | string, message?: string): void {
        const index = this.errors.size;
        if (typeof invalidOrMessage === 'string') {
            this.errors.set(index, invalidOrMessage);
        } else if (message) {
            this.errors.set(index, invalidOrMessage ? message : null);
        }
    }

    protected abstract validate(value?: T): void;

    protected isEmpty(value?: T): boolean {
        if (value === undefined || value === null) return true;
        if (typeof value === 'string') return value.trim() === '';
        return false;
    }

    /** Synchronous validation — sets state directly. */
    public handle(value?: T) {
        this.value = value;
        this.errors = new Map();

        const empty = this.isEmpty(value);

        if (this.options?.required && empty) {
            this.addError("This field is required");
            this.setState({ status: "error", errors: this.getErrors() });
            return this;
        }

        if (!empty) {
            this.validate(value);
        }

        this.setState(
            this.hasError()
                ? { status: "error", errors: this.getErrors() }
                : { status: "valid" });
        return this;
    }

    /** Async-aware validation. Sync validators just delegate to handle(). */
    public async handleAsync(value?: T): Promise<this> {
        this.handle(value);
        return this;
    }

    public getValue(): T | undefined {
        return this.value;
    }
}