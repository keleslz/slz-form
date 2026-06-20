import { IValidator } from "../slz-lib/core";

/** No rule of its own — only enforces the `required` flag from setOptions. */
export class RequiredValidator extends IValidator<string> {
    protected validate(): void {
        // intentionally empty
    }
}
