import { IValidator, type ValidationOption } from "./IValidator";

/**
 * Decorator that debounces the inner validator: stays "idle" while the user is typing,
 * and only triggers the inner validation after `waitMs` of inactivity.
 *
 * The inner validator owns its own loading lifecycle — this wrapper only delays the trigger.
 * It mirrors the inner's state, errors, and notifications, so the consumer only ever
 * interacts with this wrapper.
 */
export class DebouncedValidator extends IValidator<string> {
    private inner: IValidator<string>;
    private waitMs: number;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private currentOptions: ValidationOption = {};

    constructor(inner: IValidator<string>, waitMs = 500) {
        super();
        this.inner = inner;
        this.waitMs = waitMs;

        // Re-emit inner state changes as ours, so subscribers of `this` see them.
        this.inner.subscribe(() => {
            this.setState(this.inner.getState());
        });
    }

    public override setOptions(options: ValidationOption): this {
        this.currentOptions = options;
        this.inner.setOptions(options);
        return this;
    }

    public override hasError(): boolean {
        return this.inner.hasError();
    }

    public override getErrors(): string[] {
        return this.inner.getErrors();
    }

    public override getFirstError(): string | null {
        return this.inner.getFirstError();
    }

    protected validate(_value?: string): void {
        // No-op: handleAsync is the real entry point for this decorator.
    }

    /**
     * Override the full async entry point: we don't want the IAsyncValidator's automatic
     * "loading" transition during the debounce window — the inner validator will handle
     * its own loading state when it actually starts.
     */
    public override async handleAsync(value?: string): Promise<this> {
        if (this.timer) {
            clearTimeout(this.timer);
        }

        // Empty value: nothing to debounce — settle immediately via sync handle.
        if (this.isEmpty(value)) {
            this.inner.setOptions(this.currentOptions).handle(value);
            return this;
        }

        // While the user is still typing, stay idle. No spinner, no lock.
        this.setState({ status: "idle" });

        return new Promise((resolve) => {
            this.timer = setTimeout(() => {
                this.inner
                    .setOptions(this.currentOptions)
                    .handleAsync(value)
                    .finally(() => resolve(this));
            }, this.waitMs);
        });
    }
}

