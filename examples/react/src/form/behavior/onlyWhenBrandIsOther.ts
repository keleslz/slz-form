import { hideWhen } from "../car-configuration-form";

/**
 * Émet `invisible` : la vue cesse de rendre le champ en lisant le flag.
 *
 * Depuis l'arbitrage 35, `invisible` n'est plus qu'un fait d'affichage pour le
 * payload : `otherBrand` reste monté quand `brand ≠ "other"`, donc sa valeur
 * part désormais avec le formulaire même masqué. Ce n'est pas une fuite, c'est
 * la règle — pour l'exclure du payload, il faudrait le démonter, pas seulement
 * le masquer. La validité, elle, continue de l'ignorer tant qu'il est caché.
 */
export const onlyWhenBrandIsOther = hideWhen({
    watch: ["brand"],
    when: ({ brand }) => brand !== "other",
});
