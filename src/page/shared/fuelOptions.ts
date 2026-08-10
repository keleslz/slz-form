import type { Option } from "../../api/types";

/** Static list — no endpoint behind it, so both implementations use it as-is. */
export const FUEL_OPTIONS: readonly Option[] = [
    { value: "electric", label: "Électrique" },
    { value: "hybrid", label: "Hybride" },
    { value: "petrol", label: "Essence" },
];
