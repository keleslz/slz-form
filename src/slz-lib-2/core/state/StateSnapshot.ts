import type { FieldValue } from "../ui/FieldValue";
import type { ValidatorState } from "../validator/ValidatorState";
import type { StateFlags } from "./StateFlag";

export class StateSnapshot {
    readonly params?: {
        name: string;
        value?: FieldValue
        flags: StateFlags
        interactions: {
            touched: boolean
            focused: boolean
        }
        validatorState?: ValidatorState
    }

    constructor(params?: typeof this.params) {
        this.params = params;
    }

    hasFlags(...flags: StateFlags) {
        if (!this.params) {
            return false
        }
        return this.params.flags.some(f => flags.some(f_ => f === f_))
    }

    getValue() {
        if (!this.params) {
            return null
        }
        return this.params.value
    }
}