import { lockWhile } from "./lockWhile";
import type { IBehavior } from "./IBehavior";

/**
 * Shorthand for `lockWhile(["loading"])`.
 * Adds the `"locked"` flag whenever the field's validator is in a loading state.
 */
export function lockWhileLoading(): IBehavior {
    return lockWhile(["loading"]);
}
