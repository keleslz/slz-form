import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    FormController,
    IValidator,
    type IBehavior,
    type ValidationReport,
} from "../src/index";
import { until, wait } from "./helpers";

/**
 * Le moteur ne loggue plus jamais (invariant 38). Toute erreur asynchrone d'un
 * hook, tout échec de règle, toute violation de garde est **routée** vers le
 * formulaire : lisible par `form.engineErrors`, écoutable par
 * `form.onEngineError`. Chaque test vérifie donc deux choses — l'erreur atterrit
 * bien sur le formulaire, et la console n'a **jamais** été touchée.
 */
describe("le moteur route ses erreurs vers le formulaire", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("un behavior async qui lève route une erreur behavior/hook-error", async () => {
        const form = new FormController<{ a: string }>({ name: "e1" });
        const boom: IBehavior<string> = {
            onChange: async () => {
                await wait(5);
                throw new Error("réseau tombé");
            },
        };
        const field = form.field("a", { behaviors: [boom] });
        field.mount();
        form.mount();
        field.change("x");
        await until(() => form.engineErrors.length > 0);

        expect(errorSpy).not.toHaveBeenCalled();
        expect(form.engineErrors).toHaveLength(1);
        const [reported] = form.engineErrors;
        expect(reported?.scope).toBe("behavior");
        expect(reported?.kind).toBe("hook-error");
        expect(reported?.field).toBe("a");
        expect((reported?.error as Error).message).toBe("réseau tombé");
    });

    it("une règle async qui lève route une erreur validator, avec le nom de la règle", async () => {
        class Boom extends IValidator<string> {
            protected async validate(): Promise<void> {
                await wait(5);
                throw new Error("règle cassée");
            }
        }
        const form = new FormController<{ a: string }>({ name: "e2" });
        const field = form.field("a", { validator: new Boom() });
        field.mount();
        form.mount();
        // Valeur non vide : la règle tourne, contrairement au montage à vide.
        field.change("x");
        await until(() => form.engineErrors.length > 0);

        expect(errorSpy).not.toHaveBeenCalled();
        expect(form.engineErrors).toHaveLength(1);
        const [reported] = form.engineErrors;
        expect(reported?.scope).toBe("validator");
        expect(reported?.kind).toBe("hook-error");
        expect(reported?.rule).toBe("Boom");
        expect(reported?.field).toBe("a");
    });

    it("dans un composite, un membre qui casse n'emporte pas le constat d'un autre", async () => {
        class Breaks extends IValidator<string> {
            protected async validate(): Promise<void> {
                await wait(5);
                throw new Error("membre cassé");
            }
        }
        class Refuses extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(value === "nope", "valeur refusée");
            }
        }
        const form = new FormController<{ a: string }>({ name: "e3" });
        const field = form.field("a", { validator: [new Breaks(), new Refuses()] });
        field.mount();
        form.mount();
        field.change("nope");
        await until(() => field.snapshot.errors.includes("valeur refusée"));
        await until(() => form.engineErrors.length > 0);

        expect(errorSpy).not.toHaveBeenCalled();
        // Le membre sain a bien conclu : son refus survit à la panne de l'autre.
        expect(field.snapshot.errors).toContain("valeur refusée");
        const [reported] = form.engineErrors;
        expect(reported?.scope).toBe("validator");
        expect(reported?.rule).toBe("Breaks");
    });

    it("un validator détaché qui casse ne crashe pas, ne loggue pas, ne touche aucun form", async () => {
        class Boom extends IValidator<string> {
            override readonly validateWhenEmpty = true;
            protected async validate(): Promise<void> {
                await wait(5);
                throw new Error("détaché");
            }
        }
        const validator = new Boom();
        // Appelé hors de tout formulaire : le contexte détaché ne porte pas de
        // sink, donc l'échec est silencieux — angle mort assumé.
        await expect(validator.handle("x")).resolves.toBeDefined();
        await wait(20);

        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("un abonné onEngineError qui lève ne fait ni boucler ni crasher", async () => {
        const form = new FormController<{ a: string }>({ name: "e5" });
        let calls = 0;
        form.onEngineError(() => {
            calls += 1;
            throw new Error("abonné fautif");
        });
        const boom: IBehavior<string> = {
            onChange: async () => {
                await wait(5);
                throw new Error("panne");
            },
        };
        const field = form.field("a", { behaviors: [boom] });
        field.mount();
        form.mount();
        field.change("x");
        await until(() => form.engineErrors.length > 0);
        await wait(20);

        // Appelé une fois, son throw avalé — jamais re-routé, sinon la panne de
        // l'abonné alimenterait le canal en boucle (trap B).
        expect(calls).toBe(1);
        expect(errorSpy).not.toHaveBeenCalled();
        expect(form.engineErrors).toHaveLength(1);
    });

    it("le tampon est borné aux 50 plus récentes, et vidé par reset()", async () => {
        const form = new FormController<{ a: string }>({ name: "e6" });
        const boom: IBehavior<string> = {
            onChange: async () => {
                await wait(1);
                throw new Error("panne");
            },
        };
        const field = form.field("a", { behaviors: [boom] });
        field.mount();
        form.mount();
        for (let i = 0; i < 60; i += 1) {
            field.change(`v${i}`);
        }
        // 60 rejets pour 50 places : le tampon plafonne, il ne grossit pas sans fin.
        await until(() => form.engineErrors.length === 50, { timeout: 2000 });
        await wait(30);
        expect(form.engineErrors).toHaveLength(50);

        form.reset();
        expect(form.engineErrors).toHaveLength(0);
    });
});
