/** Simulated remote fetch — returns a list of options after 1.5s. */
export function fakeFetchOptions(signal: AbortSignal): Promise<{ label: string; value: string }[]> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve([
            { value: "visa", label: "Visa" },
            { value: "mastercard", label: "Mastercard" },
            { value: "amex", label: "American Express" },
        ]), 1500);
        signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("aborted", "AbortError"));
        });
    });
}
