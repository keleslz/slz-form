import { IValidator } from "../slz-lib/core";

export class EmailValidator extends IValidator<string> {
    public validate(value: string) {
        this.addError(!value.includes('@'), "Email must contain '@'");
    }
}