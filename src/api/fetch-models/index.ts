import { delay } from "../delay";
import type { Option } from "../types";

const MODELS: Record<string, Option[]> = {
    renault: [
        { value: "clio", label: "Clio" },
        { value: "megane", label: "Mégane" },
        { value: "scenic", label: "Scénic" },
    ],
    peugeot: [
        { value: "208", label: "208" },
        { value: "308", label: "308" },
        { value: "3008", label: "3008" },
    ],
    tesla: [
        { value: "model3", label: "Model 3" },
        { value: "modely", label: "Model Y" },
    ],
};

export function fetchModels(brand: string | undefined): Promise<readonly Option[]> {
    if (!brand) {
        return Promise.resolve([]);
    }
    return delay(MODELS[brand] ?? [], 700);
}
