const counts = new Map<string, number>();

/**
 * Demo instrument, deliberately outside React: it shows which components
 * actually re-render when a single field changes.
 *
 * StrictMode renders twice, so read the counters relatively, not absolutely.
 */
export function countRender(key: string): number {
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
}

export function resetRenderCounts(): void {
    counts.clear();
}
