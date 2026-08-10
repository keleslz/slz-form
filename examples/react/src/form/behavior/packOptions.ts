import { fetchOptionPacks } from "../../api/fetch-option-packs";
import { loadOptions } from "slz-form";

export const packOptions = loadOptions<string[]>(fetchOptionPacks);
