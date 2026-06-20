import { IValidator } from "./IValidator";

export abstract class IAsyncValidator<T> extends IValidator<T> {
    protected abstract validateAsync(value?: T): Promise<void>;

    public override async handleAsync(value?: T): Promise<this> {
        this.handle(value);
        // No async work to do on empty values — the sync `handle` already settled the state.
        if (this.isEmpty(value)) {
            return this;
        }
        this.setState({ status: "loading" });
        await this.validateAsync(value);
        this.setState(
            this.hasError()
                ? { status: "error", errors: this.getErrors() }
                : { status: "valid" },
        );
        return this;
    }
}