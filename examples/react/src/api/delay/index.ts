/** Stand-in for real network latency, so the loading states are actually visible. */
export function delay<T>(value: T, ms: number): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
