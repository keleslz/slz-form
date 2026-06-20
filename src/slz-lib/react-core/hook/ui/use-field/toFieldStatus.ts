import type { ValidatorState } from "../../validator";
import type { FieldStatus } from "./useField";

export function toFieldStatus(s: ValidatorState["status"], errors: string[]): FieldStatus {
    if (s === "error") return { value: "error", errors };
    if (s === "valid") return { value: "valid" };
    return { value: "idle" };
}