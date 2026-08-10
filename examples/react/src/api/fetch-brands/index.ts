import { delay } from "../delay";
import type { Option } from "../types";

const BRANDS: Option[] = [
    { value: "renault", label: "Renault" },
    { value: "peugeot", label: "Peugeot" },
    { value: "tesla", label: "Tesla" },
    { value: "other", label: "Autre…" },
];

export function fetchBrands(): Promise<readonly Option[]> {
    return delay(BRANDS, 600);
}
