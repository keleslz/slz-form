import { delay } from "../delay";

/** Counts every call, so both implementations can be compared on request volume. */
let calls = 0;

export function isPlateAvailable(plate: string): Promise<boolean> {
    calls += 1;
    return delay(!plate.toUpperCase().startsWith("AA"), 800);
}

export function plateCheckCalls(): number {
    return calls;
}

export function resetPlateCheckCalls(): void {
    calls = 0;
}
