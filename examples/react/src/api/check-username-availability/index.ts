import { delay } from "../delay";

/** Compteur d'appels : c'est ce qui rend le gain du debounce mesurable. */
let calls = 0;

const TAKEN = ["ada", "grace", "alan"];

export function isUsernameAvailable(username: string): Promise<boolean> {
    calls += 1;
    return delay(!TAKEN.includes(username.trim().toLowerCase()), 500);
}

export function usernameCheckCalls(): number {
    return calls;
}

export function resetUsernameCheckCalls(): void {
    calls = 0;
}
