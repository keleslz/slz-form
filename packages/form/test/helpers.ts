import type { IBehavior } from "../src/index";

export const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Recopie la valeur d'un champ observé dans le champ porteur, sans délai. */
export const copyFrom = (source: string): IBehavior<string> => ({
    watch: [source],
    onDependencyChanged: (ctx, dependency) => {
        ctx.setValue(`${ctx.name}:${String(dependency.value)}`);
    },
});

/** Behavior qui observe sans rien faire — pour construire un graphe de test. */
export const observes = (source: string): IBehavior<string> => ({
    watch: [source],
    onDependencyChanged: () => undefined,
});
