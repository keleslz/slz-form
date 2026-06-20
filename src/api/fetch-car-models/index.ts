/** Simulated remote fetch — returns a list of options after 1.5s. */
export function fetchVehicleModels(signal: AbortSignal): Promise<{ label: string; value: string }[]> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve([
            { value: "twingo", label: "Twingo" },
            { value: "renault_5", label: "Renault 5" },
            { value: "renault_5_turbo_3E", label: "Renault 5 Turbo 3E" },
            { value: "clio", label: "Clio" },
            { value: "new_clio", label: "Nouvelle Clio" },
            { value: "renault_4", label: "Renault 4" },
            { value: "megane", label: "Megane" },
            { value: "captur", label: "Capture" },
        ]), 1500);
        signal.addEventListener("abort", () => {
            clearTimeout(t);
            reject(new DOMException("aborted", "AbortError"));
        });
    });
}
