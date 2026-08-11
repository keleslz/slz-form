import { fetchBrands } from "../../api/fetch-brands";
import { loadOptions } from "../car-configuration-form";

/** Le meta conserve l'enregistrement brut : plus rien ne se perd en route. */
export const brandOptions = loadOptions({
    field: "brand",
    fetch: async () => (await fetchBrands()).map((brand) => ({
        value: brand.value,
        label: brand.label,
        disabled: brand.disabled,
        meta: { id: brand.value, name: brand.label, country: "FR" },
    })),
});
