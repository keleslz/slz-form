import {
    isEmpty,
    REQUIRED_MESSAGE,
    validateConsent,
    validateEmail,
    validateFile,
    validateFutureDate,
    validateMaxSelection,
    validatePlateFormat,
    validateRange,
    validateTimeWindow,
    validateUsernameFormat,
} from "../../validation";
import { REQUIRED_FIELDS, type FieldName, type Values } from "./values";

export type Errors = Partial<Record<FieldName, string>>;

const maxTwoPacks = validateMaxSelection(2);
const mileageRange = validateRange(0, 300000);
const licenceFile = validateFile(512 * 1024, ["image/png", "image/jpeg"]);
const deliveryWindow = validateTimeWindow(8, 19);

/**
 * Every rule is re-dispatched by hand, and the `required` check has to be
 * repeated in front of each one: a rule must not run on an empty value, but
 * `required` must still fire. The engine does this dispatch itself.
 */
export function validateField(name: FieldName, values: Values): string | undefined {
    const value = values[name];

    if (REQUIRED_FIELDS.includes(name) && isEmpty(value)) {
        return REQUIRED_MESSAGE;
    }

    switch (name) {
        case "email":
            return isEmpty(value) ? undefined : validateEmail(values.email) ?? undefined;
        case "plate":
            return isEmpty(value) ? undefined : validatePlateFormat(values.plate) ?? undefined;
        case "username":
            return isEmpty(value) ? undefined : validateUsernameFormat(values.username) ?? undefined;
        case "packs":
            return maxTwoPacks(values.packs) ?? undefined;
        case "mileage":
            return values.mileage === undefined ? undefined : mileageRange(values.mileage) ?? undefined;
        case "consent":
            return validateConsent(values.consent) ?? undefined;
        case "deliveryDate":
            return isEmpty(value) ? undefined : validateFutureDate(values.deliveryDate) ?? undefined;
        case "deliverySlot":
            return isEmpty(value) ? undefined : deliveryWindow(values.deliverySlot) ?? undefined;
        case "inspectionAt":
            return isEmpty(value) ? undefined : validateFutureDate(values.inspectionAt) ?? undefined;
        case "licence":
            return values.licence === undefined ? undefined : licenceFile(values.licence) ?? undefined;
        default:
            return undefined;
    }
}

export function validateAll(values: Values): Errors {
    const errors: Errors = {};
    for (const name of Object.keys(values) as FieldName[]) {
        const error = validateField(name, values);
        if (error) {
            errors[name] = error;
        }
    }
    return errors;
}
