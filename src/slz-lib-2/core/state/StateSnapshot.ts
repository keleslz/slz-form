import type { FieldValue } from "../ui/FieldValue";
import type { ValidatorState } from "../validator/ValidatorState";
import type { StateFlags } from "./StateFlag";

export type StateSnapshot = {
    name: string;
    value?: FieldValue
    flags: StateFlags
    interactions: {
        touched: boolean
        focused: boolean
    }
    validatorState?: ValidatorState
}