import { fetchCityByPostcode } from "../../api/fetch-city-by-postcode";
import { lookup } from "slz-form";

/**
 * Behavior asynchrone qui **écrit** : la ville se remplit depuis le code postal.
 *
 * C'est bien le champ « ville » qui porte ce behavior et observe « postcode » —
 * jamais l'inverse. Un champ n'écrit que dans son propre état.
 */
export const cityFromPostcode = lookup(
    (ctx) => fetchCityByPostcode(ctx.watched("postcode")?.value as string | undefined),
    { watch: ["postcode"], debounce: 400 },
);
