import type { BehaviorContext, IBehavior } from "../behavior";
import type {
    FieldOption,
    FieldsShape,
    MetaOf,
    OptionValueOf,
    ValueOf,
    WatchedValues,
} from "../field";
import type { FormController } from "../form/FormController";
import { loadOptions, type LoadOptionsTrigger } from "./loadOptions";
import { lockWhile } from "./lockWhile";
import { lookup } from "./lookup";
import { openWhilePending, type PendingState } from "./pending";
import { prefill } from "./prefill";

/**
 * Les behaviors d'un formulaire, liés à sa map de champs.
 *
 * ```ts
 * export const { lookup, loadOptions, suggest, lockWhile, hideWhen } = behaviorsFor(carForm);
 * ```
 *
 * Tout ce qui suit en découle : les noms observés sont contraints aux champs
 * qui existent, leurs valeurs arrivent typées dans le callback, et le retour du
 * fetch est vérifié contre le type du champ visé. Plus de `watch` à répéter dans
 * la lecture, plus de `ctx.watched(...)`, plus de cast.
 *
 * Le formulaire n'est utilisé que pour son **type** : rien n'est retenu à
 * l'exécution, les behaviors produits restent de simples objets.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- le formulaire n'est lu que pour son type
export function behaviorsFor<TFields extends FieldsShape>(_form: FormController<TFields>) {
    type Name = Extract<keyof TFields, string>;

    /** Ce que reçoit un callback : les champs observés, plus la valeur du champ. */
    type Deps<K extends Name, W extends Name> = WatchedValues<TFields, W> & {
        readonly value: ValueOf<TFields[K]> | undefined;
    };

    /** Valeurs des champs observés seuls — pour les behaviors qui n'écrivent pas. */
    const readWatched = <W extends Name>(
        ctx: BehaviorContext<never, never>,
        watch: readonly W[],
    ): WatchedValues<TFields, W> => {
        const deps: Record<string, unknown> = {};
        for (const name of watch) {
            deps[name] = ctx.watched(name)?.value;
        }
        return deps as WatchedValues<TFields, W>;
    };

    /** Idem, plus la valeur du champ porteur. */
    const readDeps = <K extends Name, W extends Name>(
        ctx: BehaviorContext<ValueOf<TFields[K]>, MetaOf<TFields[K]>>,
        watch: readonly W[],
    ): Deps<K, W> => {
        const deps: Record<string, unknown> = { value: ctx.getValue() };
        for (const name of watch) {
            deps[name] = ctx.watched(name)?.value;
        }
        return deps as Deps<K, W>;
    };

    return {
        /** Appelle une API et **écrit** la valeur du champ visé. */
        lookup<K extends Name, W extends Name = never>(params: {
            field: K;
            watch?: readonly W[];
            debounce?: number;
            pending?: PendingState;
            fetch: (deps: Deps<K, W>) => Promise<ValueOf<TFields[K]> | undefined>;
        }): IBehavior<ValueOf<TFields[K]>, MetaOf<TFields[K]>> {
            const watch = params.watch ?? [];
            return lookup<ValueOf<TFields[K]>>(
                (ctx) => params.fetch(readDeps<K, W>(ctx, watch)),
                { watch, debounce: params.debounce, pending: params.pending },
            ) as IBehavior<ValueOf<TFields[K]>, MetaOf<TFields[K]>>;
        },

        /** Charge la liste d'options du champ visé. */
        loadOptions<K extends Name, W extends Name = never>(params: {
            field: K;
            watch?: readonly W[];
            on?: readonly LoadOptionsTrigger[];
            debounce?: number;
            pending?: PendingState;
            resetOnReload?: boolean;
            /** Appelé si le chargement échoue — sans quoi l'échec ressemble à une liste vide. */
            onError?: (error: unknown) => void;
            fetch: (
                deps: Deps<K, W>,
            ) => Promise<readonly FieldOption<OptionValueOf<TFields[K]>, MetaOf<TFields[K]>>[]>;
        }): IBehavior<ValueOf<TFields[K]>, MetaOf<TFields[K]>> {
            const watch = params.watch ?? [];
            return loadOptions<ValueOf<TFields[K]>, MetaOf<TFields[K]>>(
                (ctx) => params.fetch(readDeps<K, W>(ctx, watch)),
                {
                    watch,
                    on: params.on,
                    debounce: params.debounce,
                    pending: params.pending,
                    resetOnReload: params.resetOnReload,
                    onError: params.onError && ((error) => params.onError?.(error)),
                },
            );
        },

        /**
         * Champ de recherche : la frappe recharge les suggestions, et le champ
         * reste utilisable — `loading` sans `locked`.
         */
        suggest<K extends Name>(params: {
            field: K;
            debounce?: number;
            pending?: PendingState;
            fetch: (
                deps: Deps<K, never>,
            ) => Promise<readonly FieldOption<OptionValueOf<TFields[K]>, MetaOf<TFields[K]>>[]>;
        }): IBehavior<ValueOf<TFields[K]>, MetaOf<TFields[K]>> {
            return loadOptions<ValueOf<TFields[K]>, MetaOf<TFields[K]>>(
                (ctx) => params.fetch(readDeps<K, never>(ctx, [])),
                {
                    on: ["change"],
                    debounce: params.debounce ?? 300,
                    pending: params.pending ?? openWhilePending,
                },
            );
        },

        /** Remplit le champ depuis une API au montage, verrouillé pendant l'appel. */
        prefill<K extends Name>(params: {
            field: K;
            fetch: (deps: Deps<K, never>) => Promise<ValueOf<TFields[K]> | undefined>;
        }): IBehavior<ValueOf<TFields[K]>, MetaOf<TFields[K]>> {
            return prefill<ValueOf<TFields[K]>>(
                (ctx) => params.fetch(readDeps<K, never>(ctx, [])),
            ) as IBehavior<ValueOf<TFields[K]>, MetaOf<TFields[K]>>;
        },

        /** Verrouille le champ tant que la condition tient. */
        lockWhile<W extends Name = never>(params: {
            watch?: readonly W[];
            when: (deps: WatchedValues<TFields, W>) => boolean;
        }): IBehavior<never, never> {
            const watch = params.watch ?? [];
            return lockWhile<never>((ctx) => params.when(readWatched(ctx, watch)), watch);
        },

        /**
         * Verrouille tant qu'un des champs observés n'est pas **valide**.
         *
         * C'est le seul helper qui observe la validité plutôt que la valeur :
         * il déclare `on: ["validity"]`. Pour toute autre réaction à l'état d'un
         * voisin, un `IBehavior` écrit à la main accepte la même déclaration.
         */
        lockUntilValid<W extends Name>(params: { watch: readonly W[] }): IBehavior<never, never> {
            const watch = params.watch.map((field) => ({ field, on: ["validity"] as const }));
            const compute = (ctx: BehaviorContext<never, never>) => {
                // Le verdict — `errors` vide — et non le flag `error` : un champ
                // prérempli et correct reste `pristine` tant qu'on n'y a pas
                // touché, et le verrouiller pour ça ne se débloquerait jamais.
                const allValid = params.watch.every((field) => {
                    const view = ctx.watched(field);
                    return view !== null && view.errors.length === 0;
                });
                return allValid ? ctx.state.unlock() : ctx.state.lock();
            };
            return { watch, onMount: compute, onDependencyChanged: compute };
        },

        /** Émet `invisible` tant que la condition tient. */
        hideWhen<W extends Name = never>(params: {
            watch?: readonly W[];
            when: (deps: WatchedValues<TFields, W>) => boolean;
        }): IBehavior<never, never> {
            const watch = params.watch ?? [];
            // `hideWhen` bas niveau lit le formulaire entier ; ici la condition ne
            // voit que les champs déclarés, ce qui est plus strict et suffit.
            const compute = (ctx: BehaviorContext<never, never>) =>
                params.when(readWatched(ctx, watch)) ? ctx.state.hide() : ctx.state.show();
            return { watch, onMount: compute, onDependencyChanged: compute };
        },
    };
}
