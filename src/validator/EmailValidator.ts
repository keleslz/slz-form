import { PromiseHelper } from "../helper";
import { IValidator } from "../slz-lib-2";

export class EmailValidator extends IValidator {
    public async validate(value: string) {
        this.addError(!value.includes('@'), "Email must contain '@'");
    }
}