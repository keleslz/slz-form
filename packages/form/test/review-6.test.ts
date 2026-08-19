import { describe, expect, it } from "vitest";
import {
    behaviorsFor,
    ExternalValidator,
    FormController,
    IValidator,
    type IBehavior,
    type ValidationReport,
} from "../src/index";
import { until, wait } from "./helpers";

class Passing extends IValidator<string> {
    protected validate(): void {
        // aucune règle
    }
}

/** Règle asynchrone qui casse — un réseau tombé. */
class Flaky extends IValidator<string> {
    override readonly validateWhenEmpty = true;
    protected async validate(): Promise<void> {
        await wait(5);
        throw new Error("réseau HS");
    }
}

describe("sixième tour de revue", () => {
    it("une règle qui casse n'efface pas le verdict des règles qui ont réussi", async () => {
        const form = new FormController<{ a: string }>({ name: "x1" });
        const field = form.field("a", { required: true, validator: [new Flaky(), new Passing()] });
        field.mount();
        form.mount();
        await wait(60);

        // `required` a parlé avant l'échec : son constat doit survivre.
        expect(field.snapshot.errors).toEqual(["This field is required"]);
        expect(field.snapshot.isBlocking).toBe(true);
        expect(form.snapshot.isValid).toBe(false);
        await expect(form.submit()).resolves.toBe(false);
    });

    it("une règle qui casse n'efface pas un constat serveur déjà posé", async () => {
        const form = new FormController<{ email: string }>({ name: "x2" });
        const serverIssues = new ExternalValidator<string>();
        const field = form.field("email", { validator: [new Flaky(), serverIssues] });
        field.mount();
        form.mount();
        field.change("a@b.c");
        await wait(60);

        serverIssues.set([{ message: "Déjà pris", severity: "error", code: "taken" }]);
        await until(() => field.snapshot.errors.length > 0);

        expect(field.snapshot.errors).toEqual(["Déjà pris"]);
        await expect(form.submit()).resolves.toBe(false);
    });

    it("une règle qui casse ne fabrique pas de message d'une autre règle", async () => {
        const form = new FormController<{ email: string }>({ name: "x3" });
        class Mail extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(!value.includes("@"), "adresse invalide");
            }
        }
        const field = form.field("email", { required: true, validator: [new Mail(), new Flaky()] });
        field.mount();
        form.mount();
        field.change("pas-un-email");
        await wait(80);

        expect(field.snapshot.errors).toEqual(["adresse invalide"]);
        // Un champ rempli ne doit jamais porter le message d'obligation.
        expect(field.snapshot.errors).not.toContain("This field is required");
    });

    it("un champ touché et invalide n'est jamais publié pristine", async () => {
        const form = new FormController<{ a: string }>({ name: "x4" });
        class Refuses extends IValidator<string> {
            protected validate(_value: string, report: ValidationReport): void {
                report.error("refusé");
            }
        }
        const field = form.field("a", { validator: [new Refuses(), new Flaky()] });
        field.mount();
        form.mount();
        field.change("x");
        await wait(80);

        expect(field.snapshot.errors.length).toBeGreaterThan(0);
        expect(field.snapshot.validity).not.toBe("pristine");
        expect(field.snapshot.showError).toBe(true);
    });

    it("récupérer un champ figé lui rend sa visibilité", async () => {
        const form = new FormController<{ a: string }>({ name: "x5", settleTimeout: 40 });
        const { lookup } = behaviorsFor(form);
        const field = form.field("a", {
            required: true,
            behaviors: [lookup({
                field: "a",
                debounce: 0,
                pending: (state) => state.loading().hide(),
                fetch: () => new Promise<string>(() => undefined),
            })],
        });
        field.mount();
        form.mount();
        field.change("valeur utilisateur");
        await wait(30);

        await expect(form.submit()).resolves.toBe(false);

        // Le champ doit revenir visible, et sa valeur rester dans le payload.
        expect(field.snapshot.isVisible).toBe(true);
        expect(form.values()).toEqual({ a: "valeur utilisateur" });
    });

    it("un behavior qui rejette rend aussi la visibilité qu'il avait prise", async () => {
        const form = new FormController<{ a: string }>({ name: "x6" });
        const failing: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading().hide().readOnly());
                await wait(10);
                throw new Error("réseau HS");
            },
        };
        const field = form.field("a", { behaviors: [failing] });
        field.mount();
        form.mount();
        await wait(60);

        expect(field.snapshot.isVisible).toBe(true);
        expect(field.snapshot.isReadOnly).toBe(false);
        expect(field.snapshot.isLoading).toBe(false);
    });

    it("un constat serveur corrigé ne revient pas à la soumission", async () => {
        const form = new FormController<{ email: string }>({ name: "x7" });
        const serverIssues = new ExternalValidator<string>();
        const field = form.field("email", { validator: [serverIssues, new Passing()] });
        field.mount();
        form.mount();
        field.change("a@b.c");
        await wait(20);

        serverIssues.set([{ message: "Déjà pris", severity: "error" }]);
        await until(() => field.snapshot.errors.length > 0);

        // Trois corrections successives : le constat ne doit jamais ressusciter.
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            field.change(`corrige-${attempt}@b.c`);
            await until(() => field.snapshot.errors.length === 0);
            await expect(form.submit()).resolves.toBe(true);
            expect(field.snapshot.errors).toEqual([]);
        }
    });

    it("un validator abandonné libère le champ et la soumission suivante", async () => {
        const form = new FormController<{ a: string }>({ name: "x8", settleTimeout: 40 });
        let calls = 0;
        // Deux appels restent en vol — celui de la saisie, puis celui que la
        // soumission déclenche — avant que le réseau ne revienne.
        class HangsTwice extends IValidator<string> {
            protected validate(): Promise<void> {
                calls += 1;
                return calls <= 2 ? new Promise<void>(() => undefined) : Promise.resolve();
            }
        }
        const field = form.field("a", { validator: new HangsTwice() });
        field.mount();
        form.mount();
        field.change("x");
        await wait(20);

        await expect(form.submit()).resolves.toBe(false);
        expect(field.isBusy).toBe(false);
        expect(field.snapshot.isLoading).toBe(false);

        await expect(form.submit()).resolves.toBe(true);
    });

    it("un composite se réabonne au remontage, même sur une valeur vide", async () => {
        const form = new FormController<{ a: string }>({ name: "x9" });
        const serverIssues = new ExternalValidator<string>();
        const field = form.field("a", { validator: [serverIssues, new Passing()] });

        field.mount();
        serverIssues.set([{ message: "constat 1", severity: "error" }]);
        await until(() => field.snapshot.errors.length > 0);

        field.unmount();
        field.mount();
        form.mount();
        await wait(20);

        serverIssues.set([{ message: "constat 2", severity: "error" }]);
        await until(() => field.snapshot.errors[0] === "constat 2");
        expect(field.snapshot.errors).toEqual(["constat 2"]);
    });
});
