import { IValidator } from "../slz-lib/core";
export class PhoneValidator extends IValidator<string> {
    public validate(value?: string) {
        this.addError(!/^\d{10}$/.test(value ?? ""), "Phone number must be 10 digits");
    }
}