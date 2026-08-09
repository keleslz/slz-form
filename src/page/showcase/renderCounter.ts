const counts = new Map<string, number>();

/**
 * Demo instrument, deliberately outside React: evidence for invariant 22 —
 * typing in one field leaves the other counters untouched.
 *
 * StrictMode renders twice, so read the counters relatively, not absolutely.
 */
export function countRender(key: string): number {
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
}
