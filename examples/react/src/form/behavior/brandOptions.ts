import { fetchBrands } from "../../api/fetch-brands";
import { loadOptions } from "slz-form";

/** Plain async fetch on mount, no dependency. */
export const brandOptions = loadOptions(fetchBrands);
