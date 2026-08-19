import type { BehaviorContext, IBehavior } from "../behavior";
import type { BehaviorState } from "../state";
import { createDebouncer, type Debouncer } from "./debounce";
import { lockedWhilePending, type PendingState } from "./pending";

export interface LookupParams {
    /**
     * Champs déclencheurs. Vide → le lookup part sur la frappe du champ lui-même
     * (normalisation, complétion). Renseigné → il part quand l'un d'eux change.
     */
    watch?: readonly string[];
    /** Attente avant l'appel, en ms. 0 = immédiat. */
    debounce?: number;
    /**
     * État porté pendant le travail. Défaut : `loading` + `locked`, parce qu'on
     * s'apprête à écrire dans le champ.
     */
    pending?: PendingState;
}

/**
 * Behavior asynchrone qui **écrit** : il appelle une API et remplace la valeur
 * du champ par ce qu'elle renvoie.
 *
 * C'est le pendant de la validation asynchrone, et l'autre moitié du besoin. Un
 * validator *juge* une valeur et ne peut pas y toucher ; un behavior *écrit* et
 * ne peut pas se prononcer sur la validité. Aucun des deux ne remplace l'autre.
 *
 * ```ts
 * // le champ « ville » se remplit à partir du code postal
 * lookup((ctx) => fetchCity(ctx.watched("postcode")?.value as string), {
 *     watch: ["postcode"],
 *     debounce: 400,
 * })
 * ```
 *
 * L'écriture passe par `ctx.setValue`, qui ne marque pas le champ touché : une
 * valeur venue d'une API n'est pas une interaction utilisateur, le champ reste
 * `pristine` tant que l'utilisateur ne l'a pas modifiée.
 *
 * Le champ cible est toujours **celui qui porte le behavior** : un champ ne peut
 * écrire que dans son propre état (invariants 5, 6, 20). Pour remplir B depuis
 * A, c'est B qui observe A, jamais A qui pousse vers B.
 */
export function lookup<T = string>(
    fetcher: (ctx: BehaviorContext<T>) => Promise<T | undefined>,
    params: LookupParams = {},
): IBehavior<T> {
    const watch = params.watch ?? [];
    const delay = params.debounce ?? 0;
    const pending = params.pending ?? lockedWhilePending;

    // Une fenêtre d'attente par champ : l'instance de behavior ne porte ainsi
    // que de la configuration et reste partageable entre plusieurs champs.
    // Jeton de run et fenêtres différées, indexés par **formulaire + champ**.
    // Le nom seul ne suffit pas : deux lignes d'une liste répétable ont les
    // mêmes noms de champ, et une instance partagée les ferait se marcher
    // dessus — l'une resterait verrouillée indéfiniment.
    const runs = new Map<string, number>();
    const debouncers = new Map<string, Debouncer>();
    const keyOf = (ctx: BehaviorContext<T>): string => `${ctx.form.name}\u0000${ctx.name}`;
    const debouncerOf = (name: string): Debouncer => {
        const existing = debouncers.get(name);
        if (existing) {
            return existing;
        }
        const created = createDebouncer();
        debouncers.set(name, created);
        return created;
    };

    const run = async (ctx: BehaviorContext<T>): Promise<BehaviorState> => {
        const key = keyOf(ctx);
        const token = (runs.get(key) ?? 0) + 1;
        runs.set(key, token);

        // L'état d'attente est posé dès le déclenchement, sans attendre la fin
        // du délai : l'utilisateur voit tout de suite que quelque chose est en cours.
        ctx.push(pending(ctx.state));

        if (!(await debouncerOf(key).wait(delay))) {
            // Remplacé par un déclenchement plus récent : celui-ci prend la main
            // et rendra la main sur l'état.
            return ctx.state;
        }
        if (ctx.signal.aborted) {
            return ctx.state;
        }

        const before = ctx.getValue();
        const fresh = (): boolean => !ctx.signal.aborted && runs.get(key) === token;

        try {
            const value = await fetcher(ctx);
            if (!fresh()) {
                return ctx.state;
            }
            // Si l'utilisateur a repris la main pendant l'appel, sa saisie gagne.
            // Sans verrouillage cette collision est réelle : une réponse tardive
            // écraserait ce qu'il est en train de taper.
            if (value !== undefined && Object.is(ctx.getValue(), before)) {
                ctx.setValue(value);
            }
        } catch {
            // Un lookup qui échoue laisse la valeur en place : ce n'est pas une
            // erreur de validation, et le Validator reste seul juge.
        }

        // Un run supplanté ne rend pas la main sur l'état : éteindre `loading`
        // et `locked` ici ferait croire au FormController que tout est retombé,
        // et la soumission partirait avec une valeur pas encore posée.
        return runs.get(key) === token ? ctx.state.idle().unlock().show() : ctx.state;
    };

    return {
        watch,
        onChange: watch.length === 0 ? (ctx) => run(ctx) : undefined,
        onDependencyChanged: watch.length > 0 ? (ctx) => run(ctx) : undefined,
        // Soumettre ne doit pas attendre la fin du délai : la fenêtre en attente
        // part tout de suite, et le FormController attend ensuite l'appel.
        onSubmit: (ctx) => {
            debouncers.get(keyOf(ctx))?.flush();
        },
        onUnmount: (ctx) => {
            const key = keyOf(ctx);
            debouncers.get(key)?.cancel();
            // Purge : une ligne retirée ne doit pas laisser d'entrée derrière
            // elle sur une instance de behavior partagée.
            debouncers.delete(key);
            runs.delete(key);
        },
    };
}
