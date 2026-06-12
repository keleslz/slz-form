import { IAsyncValidator } from "./IAsyncValidator";
import type { IValidator } from "./IValidator";

export class DelayedValidator extends IAsyncValidator<string> {
    private inner: IValidator<string>;
    private delayMs: number;
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(inner: IValidator<string>, delayMs = 1000) {
        super();
        this.inner = inner;
        this.delayMs = delayMs;
    }

    /** Sync phase is a no-op: the real validation runs in `validateAsync`
     *  after the simulated network delay. */
    protected validate(_value?: string): void {
        // intentionally empty
    }

    protected override async validateAsync(value?: string): Promise<void> {
        if (this.timer) clearTimeout(this.timer);
        return new Promise((resolve) => {
            this.timer = setTimeout(() => {
                this.inner.handle(value);
                for (const err of this.inner.getErrors()) {
                    this.addError(err);
                }
                this.timer = null;
                resolve();
            }, this.delayMs);
        });
    }
}
