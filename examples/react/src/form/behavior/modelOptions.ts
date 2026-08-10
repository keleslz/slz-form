import { fetchModels } from "../../api/fetch-models";
import { loadOptions } from "slz-form";

/** Dependent select: reloads and clears itself whenever `brand` changes. */
export const modelOptions = loadOptions(
    (ctx) => fetchModels(ctx.watched("brand")?.value as string | undefined),
    { watch: ["brand"] },
);
