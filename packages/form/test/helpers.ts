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

/**
 * Attend qu'une condition devienne vraie, au lieu de parier sur un délai fixe.
 *
 * Un `await wait(120)` suffit isolément et devient instable quand la suite
 * entière tourne : les tests asynchrones doivent observer un état, pas une
 * horloge.
 */
export async function until(
    condition: () => boolean,
    { timeout = 2000, step = 5 }: { timeout?: number; step?: number } = {},
): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!condition()) {
        if (Date.now() > deadline) {
            throw new Error("[test] condition jamais satisfaite dans le temps imparti");
        }
        await wait(step);
    }
}
