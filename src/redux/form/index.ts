import { createFormSlice } from "../../slz-lib/react-slz-form";

export const FORM_1 = {
    id: "myExampleForm1",
    fields: ["name", "email", "emailDebounced", "prefill", "cardType", "cardTypeDefault"]
} as const

export const FORM_2 = {
    id: "myExampleForm2",
    fields: ["name", "phone"]
} as const

export type FormStateId = typeof FORM_1['id'] | typeof FORM_2["id"];
export type FieldStateId = typeof FORM_1['fields'][number] | typeof FORM_2['fields'][number];
export const formSlice = createFormSlice<FormStateId, FieldStateId>("form");
export const formReducer = formSlice.reducer;