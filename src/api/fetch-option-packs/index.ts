import { delay } from "../delay";
import type { Option } from "../types";

const PACKS: Option[] = [
    { value: "gps", label: "GPS" },
    { value: "leather", label: "Sièges cuir" },
    { value: "sunroof", label: "Toit ouvrant" },
    { value: "towbar", label: "Attelage", disabled: true },
];

export function fetchOptionPacks(): Promise<readonly Option[]> {
    return delay(PACKS, 500);
}
