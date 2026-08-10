export interface Values {
    fullName: string;
    email: string;
    plate: string;
    customerReference: string;
    comment: string;
    brand: string;
    model: string;
    otherBrand: string;
    fuel: string;
    packs: string[];
    mileage: number | undefined;
    consent: boolean;
    deliveryDate: string;
    deliverySlot: string;
    inspectionAt: string;
    licence: File | undefined;
}

export type FieldName = keyof Values;

export const INITIAL_VALUES: Values = {
    fullName: "",
    email: "",
    plate: "",
    customerReference: "",
    comment: "",
    brand: "",
    model: "",
    otherBrand: "",
    fuel: "",
    packs: [],
    mileage: undefined,
    consent: false,
    deliveryDate: "",
    deliverySlot: "",
    inspectionAt: "",
    licence: undefined,
};

/** Kept in sync by hand with the JSX below — nothing enforces it. */
export const REQUIRED_FIELDS: readonly FieldName[] = [
    "fullName", "email", "plate", "brand", "model", "fuel", "mileage", "deliveryDate", "licence",
];
