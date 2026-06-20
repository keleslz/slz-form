export const CAR_CONFIGURATION_FORM = {
    id: "CarConfiguration",
    fields: ["name", "email", "emailDebounced", "prefill", "cardType", "cardTypeDefault"]
} as const

export type CarConfigurationFormId = typeof CAR_CONFIGURATION_FORM['id']
export type CarConfigurationFormFields = typeof CAR_CONFIGURATION_FORM['fields'][number]
