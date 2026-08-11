import { searchCities } from "../../api/search-cities";
import { suggest } from "../car-configuration-form";

/**
 * Champ de recherche : `loading` sans `locked`, la frappe n'est jamais
 * interrompue. Contraste avec `cityFromPostcode`, qui écrit et verrouille.
 */
export const citySuggestions = suggest({
    field: "citySearch",
    debounce: 300,
    fetch: ({ value }) => searchCities(value),
});
