import { delay } from "../delay";
import type { Option } from "../types";

let calls = 0;

const CITIES = [
    "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes",
    "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes", "Reims",
];

/** Suggestions au fil de la frappe : la réponse ne remplace jamais la saisie. */
export function searchCities(query: string | undefined): Promise<readonly Option[]> {
    if (!query || query.trim().length < 2) {
        return Promise.resolve([]);
    }
    calls += 1;
    const needle = query.trim().toLowerCase();
    return delay(
        CITIES.filter((city) => city.toLowerCase().includes(needle))
            .map((city) => ({ value: city, label: city })),
        400,
    );
}

export function citySearchCalls(): number {
    return calls;
}
