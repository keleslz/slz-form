/**
 * Cross-field reactivity, extracted out of the FormController so it does not
 * grow into a God Object (invariant 24).
 *
 * Holds the declared edges (`field → fields it watches`) and the reverse index
 * used at propagation time. Cycles are rejected at wiring: a loop between two
 * fields is a consumer design error, and failing at registration surfaces it
 * long before it becomes an infinite propagation.
 */
export class DependencyGraph {
    private readonly dependencies = new Map<string, readonly string[]>();
    private readonly observers = new Map<string, Set<string>>();

    register(field: string, watched: readonly string[]): void {
        this.unregister(field);

        if (watched.includes(field)) {
            throw new Error(`[slz] Field "${field}" cannot watch itself.`);
        }

        this.dependencies.set(field, [...watched]);
        for (const dependency of watched) {
            const set = this.observers.get(dependency) ?? new Set<string>();
            set.add(field);
            this.observers.set(dependency, set);
        }

        const cycle = this.findCycle(field);
        if (cycle) {
            this.unregister(field);
            throw new Error(`[slz] Circular field dependency: ${cycle.join(" → ")}`);
        }
    }

    unregister(field: string): void {
        const watched = this.dependencies.get(field);
        if (!watched) {
            return;
        }
        for (const dependency of watched) {
            this.observers.get(dependency)?.delete(field);
        }
        this.dependencies.delete(field);
    }

    /** Fields to re-run when `name` changed. */
    observersOf(name: string): readonly string[] {
        const set = this.observers.get(name);
        return set ? [...set] : [];
    }

    dependenciesOf(name: string): readonly string[] {
        return this.dependencies.get(name) ?? [];
    }

    private findCycle(start: string): string[] | null {
        const path: string[] = [];
        const seen = new Set<string>();

        const walk = (node: string): boolean => {
            path.push(node);
            if (seen.has(node)) {
                return true;
            }
            seen.add(node);

            for (const next of this.dependencies.get(node) ?? []) {
                if (next === start) {
                    path.push(start);
                    return true;
                }
                if (walk(next)) {
                    return true;
                }
            }

            path.pop();
            return false;
        };

        return walk(start) ? path : null;
    }
}
