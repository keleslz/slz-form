import type { IBehavior } from "./behavior";
import { DefaultBehavior } from "./behavior/DefaultBehavior";
import type { LifeCycle } from "./lifecycle";
import type { StateFlags } from "./state/StateFlag";
import type { IValidator } from "./validator/IValidator";

export class Controller {
    private readonly behaviors: IBehavior[];
    private readonly validator?: IValidator
    private readonly field: { name: string, initialValue: string | string[] }
    private readonly stateFlags: StateFlags
    public readonly lifecycle: LifeCycle

    constructor(params: {
        behaviors?: IBehavior[];
        field: { name: string, initialValue: string | string[], required?: boolean }
        validator?: IValidator
    }) {
        this.behaviors = params.behaviors ?? [new DefaultBehavior()]
        this.validator = params.validator
        this.field = params.field
    }
}

const c: Controller = new Controller({
    field: {
        name: "test",
        initialValue: ["nada"],
    }
})

c.lifecycle.mount(() => 'run')