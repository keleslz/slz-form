/**
 * Fenêtre d'attente annulable, partagée par la validation différée et par les
 * behaviors qui appellent une API.
 *
 * `setTimeout` est un global universel (navigateur, Node, Deno, Bun, worker) :
 * le core reste agnostique.
 */
export interface Debouncer {
    /**
     * Résout `true` quand la fenêtre s'est écoulée, `false` si un appel plus
     * récent l'a remplacée. L'appelant qui reçoit `false` ne doit rien publier.
     */
    wait(ms: number): Promise<boolean>;
    /** Termine la fenêtre en cours immédiatement, comme si le délai était écoulé. */
    flush(): void;
    /** Abandonne la fenêtre en cours : l'appelant ne doit pas poursuivre. */
    cancel(): void;
}

export function createDebouncer(): Debouncer {
    let settle: ((proceed: boolean) => void) | undefined;

    const end = (proceed: boolean) => {
        const pending = settle;
        settle = undefined;
        pending?.(proceed);
    };

    return {
        wait(ms) {
            // La fenêtre précédente est remplacée, pas laissée en suspens : son
            // appelant doit reprendre la main pour ne pas attendre indéfiniment.
            end(false);

            if (ms <= 0) {
                return Promise.resolve(true);
            }

            return new Promise<boolean>((resolve) => {
                // `finish` référence `timer` dans une fermeture : il n'est jamais
                // appelé avant l'affectation, `settle` n'étant publié qu'après.
                const finish = (proceed: boolean) => {
                    clearTimeout(timer);
                    resolve(proceed);
                };
                const timer = setTimeout(() => finish(true), ms);
                settle = finish;
            });
        },
        flush: () => end(true),
        cancel: () => end(false),
    };
}
