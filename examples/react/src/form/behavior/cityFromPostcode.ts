import { fetchCityByPostcode } from "../../api/fetch-city-by-postcode";
import { lookup } from "../car-configuration-form";

/**
 * Behavior asynchrone qui **écrit**. C'est bien « ville » qui observe
 * « postcode » — jamais l'inverse : un champ n'écrit que dans son propre état.
 */
export const cityFromPostcode = lookup({
    field: "city",
    watch: ["postcode"],
    debounce: 400,
    fetch: ({ postcode }) => fetchCityByPostcode(postcode),
});
