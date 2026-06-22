import type { BehaviorContext, IBehavior } from "../slz-lib-2/core/behavior";
import type { BehaviorResult } from "../slz-lib-2/core/behavior/BehaviorResult";
import type { FieldValue } from "../slz-lib-2/core/ui/FieldValue";

export class EmailBehavior implements IBehavior {
    onChange(ctx: BehaviorContext, value: FieldValue): BehaviorResult {
        console.log(ctx, value)
        return ['error']
    }
}