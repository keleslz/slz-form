import { IValidator } from "../slz-lib/react-slz-form/validator/IValidator";

/** No rule of its own — only enforces the `required` flag from setOptions. */
export class RequiredValidator extends IValidator<string> {
    protected validate(_value?: string): void {
        // intentionally empty
    }
}
