import type { FieldOption } from "../slz-lib-v5/core";

/** Stand-in for the app's real HTTP layer — latency included, so the flags are visible. */
function delay<T>(value: T, ms: number): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const BRANDS: FieldOption[] = [
    { value: "renault", label: "Renault" },
    { value: "peugeot", label: "Peugeot" },
    { value: "tesla", label: "Tesla" },
    { value: "other", label: "Autre…" },
];

const MODELS: Record<string, FieldOption[]> = {
    renault: [
        { value: "clio", label: "Clio" },
        { value: "megane", label: "Mégane" },
        { value: "scenic", label: "Scénic" },
    ],
    peugeot: [
        { value: "208", label: "208" },
        { value: "308", label: "308" },
        { value: "3008", label: "3008" },
    ],
    tesla: [
        { value: "model3", label: "Model 3" },
        { value: "modely", label: "Model Y" },
    ],
};

export function fetchBrands(): Promise<readonly FieldOption[]> {
    return delay(BRANDS, 600);
}

export function fetchModels(brand: string | undefined): Promise<readonly FieldOption[]> {
    if (!brand) {
        return Promise.resolve([]);
    }
    return delay(MODELS[brand] ?? [], 700);
}

export function fetchOptionPacks(): Promise<readonly FieldOption[]> {
    return delay(
        [
            { value: "gps", label: "GPS" },
            { value: "leather", label: "Sièges cuir" },
            { value: "sunroof", label: "Toit ouvrant" },
            { value: "towbar", label: "Attelage", disabled: true },
        ],
        500,
    );
}

/** Prefills the customer reference from the "account" — demonstrates a locked, loading field. */
export function fetchCustomerReference(): Promise<string> {
    return delay("CUST-42-9013", 900);
}

/** Async uniqueness check — the field stays `loading` on the activity axis while it runs. */
export function isPlateAvailable(plate: string): Promise<boolean> {
    return delay(!plate.toUpperCase().startsWith("AA"), 800);
}
