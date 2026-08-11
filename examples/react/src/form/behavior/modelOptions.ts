import { fetchModels } from "../../api/fetch-models";
import { loadOptions } from "../car-configuration-form";

/** Select dépendant : rechargé et vidé à chaque changement de marque. */
export const modelOptions = loadOptions({
    field: "model",
    watch: ["brand"],
    fetch: ({ brand }) => fetchModels(brand),
});
