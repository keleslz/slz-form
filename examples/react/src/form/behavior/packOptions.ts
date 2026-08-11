import { fetchOptionPacks } from "../../api/fetch-option-packs";
import { loadOptions } from "../car-configuration-form";

/** Multi-select : la valeur du champ est `string[]`, celle d'une option `string`. */
export const packOptions = loadOptions({
    field: "packs",
    fetch: () => fetchOptionPacks(),
});
