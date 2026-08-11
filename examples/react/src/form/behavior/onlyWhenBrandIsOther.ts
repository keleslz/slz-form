import { hideWhen } from "../car-configuration-form";

/** Émet `invisible` : la vue cesse de rendre le champ en lisant le flag. */
export const onlyWhenBrandIsOther = hideWhen({
    watch: ["brand"],
    when: ({ brand }) => brand !== "other",
});
