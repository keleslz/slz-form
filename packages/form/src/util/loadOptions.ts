import type { BehaviorContext, IBehavior } from "../behavior";
import type { FieldOption } from "../field";
import type { BehaviorState } from "../state";
import { createDebouncer, type Debouncer } from "./debounce";
import { lockedWhilePending, type PendingState } from "./pending";

/** Ce qui relance le chargement de la liste. */
export type LoadOptionsTrigger = "mount" | "change" | "dependency";

export interface LoadOptionsParams {
    /** Champs dont le changement relance la liste (select dépendant). */
    watch?: readonly string[];
    /**
     * Déclencheurs. Par défaut `["mount"]`, plus `"dependency"` si `watch` est
     * renseigné. `["change"]` donne un champ de recherche : la frappe de
     * l'utilisateur recharge les suggestions.
     */
    on?: readonly LoadOptionsTrigger[];
    /** Attente avant l'appel, en ms. Indispensable pour un champ de recherche. */
    debounce?: number;
    /**
     * État porté pendant le chargement. Défaut : `loading` + `locked`.
     * Pour une recherche, `openWhilePending` laisse l'utilisateur continuer à taper.
     */
    pending?: PendingState;
    /** Vider la valeur courante quand un champ observé change. Défaut `true`. */
    resetOnReload?: boolean;
}

/**
 * « Va chercher mes options » — le besoin asynchrone le plus courant d'un select,
 * sans avoir à écrire un behavior (invariant 17).
 *
 * Couvre tout le cycle : état d'attente pendant l'appel, options publiées en cas
 * de succès, retour à l'état neutre en cas de succès **comme** d'échec.
 *
 * ```ts
 * loadOptions(fetchBrands)                                    // au montage
 * loadOptions(fetchModels, { watch: ["brand"] })              // select dépendant
 * loadOptions(search, {                                       // champ de recherche
 *     on: ["change"], debounce: 300, pending: openWhilePending,
 * })
 * ```
 *
 * Contrairement à `lookup`, ce behavior ne touche jamais à la valeur du champ —
 * sauf `resetOnReload`, qui vide un select dont la liste vient de changer sous
 * lui. Il n'entre donc jamais en collision avec la frappe de l'utilisateur.
 */
export function loadOptions<T = string>(
    fetcher: (ctx: BehaviorContext<T>) => Promise<readonly FieldOption[]>,
    params: LoadOptionsParams = {},
): IBehavior<T> {
    const watch = params.watch ?? [];
    const delay = params.debounce ?? 0;
    const pending = params.pending ?? lockedWhilePending;
    const resetOnReload = params.resetOnReload ?? true;
    const triggers = params.on ?? (watch.length > 0 ? ["mount", "dependency"] : ["mount"]);

    const debouncers = new Map<string, Debouncer>();
    const debouncerOf = (name: string): Debouncer => {
        const existing = debouncers.get(name);
        if (existing) {
            return existing;
        }
        const created = createDebouncer();
        debouncers.set(name, created);
        return created;
    };

    const load = async (ctx: BehaviorContext<T>): Promise<BehaviorState> => {
        ctx.push(pending(ctx.state));

        if (delay > 0 && !(await debouncerOf(ctx.name).wait(delay))) {
            return ctx.state;
        }
        if (ctx.signal.aborted) {
            return ctx.state;
        }

        try {
            const options = await fetcher(ctx);
            if (!ctx.signal.aborted) {
                ctx.setOptions(options);
            }
        } catch {
            if (!ctx.signal.aborted) {
                ctx.setOptions([]);
            }
        }

        return ctx.state.idle().unlock().show();
    };

    return {
        watch,
        onMount: triggers.includes("mount") ? load : undefined,
        onChange: triggers.includes("change") ? (ctx) => load(ctx) : undefined,
        onDependencyChanged: triggers.includes("dependency")
            ? (ctx) => {
                // La liste change sous le champ : la sélection précédente n'a
                // plus de sens. Ne vaut que pour un rechargement par dépendance.
                if (resetOnReload) {
                    ctx.setValue(undefined);
                }
                return load(ctx);
            }
            : undefined,
        onSubmit: (ctx) => {
            debouncers.get(ctx.name)?.flush();
        },
        onUnmount: (ctx) => debouncers.get(ctx.name)?.cancel(),
    };
}
