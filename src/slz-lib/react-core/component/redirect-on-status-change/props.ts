import type { FormStateId } from "../../../../redux"

export type RedirectOnStatusChangeProps = {
    formId: FormStateId
    to: string
    eventType: "submitted" | "error"
}