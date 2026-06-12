/** Simulated remote fetch — returns a prefill value after 1.2s. */
export function fakeFetchPrefill(signal: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve("prefilled@from.api"), 1200);
        signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("aborted", "AbortError"));
        });
    });
}