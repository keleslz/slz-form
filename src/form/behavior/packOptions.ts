import { fetchOptionPacks } from "../../api/fetch-option-packs";
import { loadOptions } from "../../slz-lib-v5/core";

export const packOptions = loadOptions<string[]>(fetchOptionPacks);
