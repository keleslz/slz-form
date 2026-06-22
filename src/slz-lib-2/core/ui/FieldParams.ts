import type { FieldValue } from "./FieldValue";

export type FieldParams = {
    name: string,
    initialValue: FieldValue,
    required?: boolean,
    focused?: boolean,
}