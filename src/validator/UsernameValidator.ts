import { IValidator } from "../slz-lib/react-slz-form/validator/IValidator";

export class UsernameValidator extends IValidator<string> {
    public validate(value: string){
        this.addError(value.length < 3, "Username must be at least 3 characters");
        this.addError(value.length > 5, "Username must be at most 5 characters");
    }
}