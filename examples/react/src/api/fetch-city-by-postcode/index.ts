import { delay } from "../delay";

let calls = 0;

const CITIES: Record<string, string> = {
    "75001": "Paris",
    "69001": "Lyon",
    "13001": "Marseille",
    "33000": "Bordeaux",
};

/** `undefined` quand le code postal est inconnu : le behavior laisse alors la valeur en place. */
export function fetchCityByPostcode(postcode: string | undefined): Promise<string | undefined> {
    if (!postcode || postcode.length < 5) {
        return Promise.resolve(undefined);
    }
    calls += 1;
    return delay(CITIES[postcode], 600);
}

export function cityLookupCalls(): number {
    return calls;
}

export function resetCityLookupCalls(): void {
    calls = 0;
}
