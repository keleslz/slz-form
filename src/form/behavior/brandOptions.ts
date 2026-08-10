import { fetchBrands } from "../../api/fetch-brands";
import { loadOptions } from "../../slz-lib-v5/core";

/** Plain async fetch on mount, no dependency. */
export const brandOptions = loadOptions(fetchBrands);
