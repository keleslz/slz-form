import { searchCities } from "../../api/search-cities";
import { loadOptions, openWhilePending } from "slz-form";

/**
 * Champ de recherche : la frappe recharge les suggestions, mais le champ reste
 * utilisable — `openWhilePending` pose `loading` sans `locked`.
 *
 * Contraste avec `cityFromPostcode`, qui **écrit** dans son champ et le
 * verrouille pendant l'appel pour ne pas écraser une saisie en cours.
 */
export const citySuggestions = loadOptions(
    (ctx) => searchCities(ctx.getValue()),
    { on: ["change"], debounce: 300, pending: openWhilePending },
);
