import type { ValidatorState } from "../../../validator";
import type { FieldStatus } from "./useField";

type Verdict = Extract<FieldStatus["value"], "idle" | "valid" | "error">;

/**
 * Project a validator state onto the flat verdict accepted by the form slice.
 * Transient validator states ("loading") collapse to "idle".
 */
export function toVerdict(s: ValidatorState): Verdict {
    return s.status === "valid" || s.status === "error" ? s.status : "idle";
}