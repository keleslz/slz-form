import { describe, expect, it } from "vitest";
import {
    behaviorsFor,
    DebouncedValidator,
    ExternalValidator,
    FormController,
    IValidator,
    type ValidationContext,
    type ValidationReport,
} from "../src/index";
import { until, wait } from "./helpers";

class Noop extends IValidator<string> {
    protected validate(): void {
        // aucune règle
    }
}

/** Refuse d'abord, puis tombe en panne. */
class RefusesThenBreaks extends IValidator<string> {
    private calls = 0;
    protected async validate(_value: string, report: ValidationReport): Promise<void> {
        this.calls += 1;
        await wait(5);
        if (this.calls === 1) {
            report.error("déjà pris", { code: "taken" });
            return;
        }
        throw new Error("503");
    }
}

describe("huitième tour de revue", () => {
    it("une passe interrompue ne fait pas disparaître un refus, composé comme seul", async () => {
        for (const [label, build] of [
            ["seul", () => new RefusesThenBreaks()],
            ["composé", () => [new RefusesThenBreaks(), new Noop()]],
        ] as const) {
            const form = new FormController<{ email: string }>({ name: `h1-${label}` });
            const field = form.field("email", { validator: build() });
            field.mount();
            form.mount();

            field.change("ada@lovelace.dev");
            await until(() => field.snapshot.errors.length > 0, { timeout: 2000 });
            expect(field.snapshot.errors, label).toEqual(["déjà pris"]);

            // Seconde passe : la règle tombe en panne. L'absence de refus ne
            // prouve rien — le dernier verdict connu doit tenir.
            field.change("ada2@lovelace.dev");
            await wait(80);

            expect(field.snapshot.errors.length > 0, label).toBe(true);
            expect(form.snapshot.hasFlag("valid"), label).toBe(false);
            await expect(form.submit(), label).resolves.toBe(false);
        }
    });

    it("un avertissement n'est pas un verdict : il n'efface pas un refus", async () => {
        const form = new FormController<{ a: string }>({ name: "h2" });
        let calls = 0;
        class WarnsThenBreaks extends IValidator<string> {
            protected async validate(_value: string, report: ValidationReport): Promise<void> {
                calls += 1;
                await wait(5);
                if (calls === 1) {
                    report.error("refusé par le serveur");
                    return;
                }
                report.warn("code postal inhabituel");
                throw new Error("503");
            }
        }
        const field = form.field("a", { validator: new WarnsThenBreaks() });
        field.mount();
        form.mount();

        field.change("premier");
        await until(() => field.snapshot.errors.length > 0, { timeout: 2000 });

        field.change("second");
        await wait(80);

        expect(field.snapshot.errors.length > 0).toBe(true);
        await expect(form.submit()).resolves.toBe(false);
    });

    it("un refus rendu pendant une passe interrompue est publié", async () => {
        const form = new FormController<{ a: string }>({ name: "h3" });
        class Breaks extends IValidator<string> {
            override readonly validateWhenEmpty = true;
            protected async validate(): Promise<void> {
                await wait(5);
                throw new Error("503");
            }
        }
        // `required` conclut avant la panne : son constat doit sortir.
        const field = form.field("a", { required: true, validator: [new Breaks(), new Noop()] });
        field.mount();
        form.mount();
        await wait(80);

        expect(field.snapshot.errors).toEqual(["This field is required"]);
        expect(field.snapshot.errors.length > 0).toBe(true);
    });

    it("une remise à zéro de constats partagés prévient tous les champs", async () => {
        const form = new FormController<{ a: string; b: string }>({ name: "h4" });
        const shared = new ExternalValidator<string>();
        const first = form.field("a", { validator: [shared, new Noop()] });
        const second = form.field("b", { validator: [shared, new Noop()] });
        first.mount();
        second.mount();
        form.mount();
        first.change("x");
        second.change("y");
        await wait(20);

        shared.set([{ message: "serveur", severity: "error" }]);
        await until(() => first.snapshot.errors.length > 0 && second.snapshot.errors.length > 0);

        shared.reset();
        await until(() => second.snapshot.errors.length === 0, { timeout: 2000 });
        expect(first.snapshot.errors).toEqual([]);
        expect(second.snapshot.errors).toEqual([]);
    });

    it("le watch d'un membre entre bien dans le graphe du formulaire", async () => {
        const form = new FormController<{ pwd: string; confirm: string }>({ name: "h5" });
        class SameAs extends IValidator<string> {
            override readonly watch = ["pwd"];
            protected validate(value: string, report: ValidationReport, ctx: ValidationContext): void {
                report.errorIf(value !== ctx.watched("pwd")?.value, "ne correspond pas");
            }
        }
        const pwd = form.field("pwd", {});
        // Composé **et** différé : les deux décorateurs doivent propager `watch`.
        const confirm = form.field("confirm", {
            validator: [new DebouncedValidator(new SameAs(), 5), new Noop()],
        });
        pwd.mount();
        confirm.mount();
        form.mount();

        pwd.change("secret");
        confirm.change("secret");
        await until(() => confirm.snapshot.ui.validity === "valid", { timeout: 2000 });

        pwd.change("autre");
        await until(() => confirm.snapshot.ui.validity === "error", { timeout: 2000 });
        expect(confirm.snapshot.errors).toEqual(["ne correspond pas"]);
    });

    it("la soumission ne rejoue que le champ dont la valeur a bougé", async () => {
        type Fields = { a: string; b: string; c: string };
        const form = new FormController<Fields>({ name: "h6" });
        const runs = { a: 0, b: 0, c: 0 };
        class Counting extends IValidator<string> {
            private readonly key: keyof typeof runs;
            constructor(key: keyof typeof runs) {
                super();
                this.key = key;
            }
            protected validate(): void {
                runs[this.key] += 1;
            }
        }

        const { lookup } = behaviorsFor(form);
        const a = form.field("a", { validator: new Counting("a") });
        const b = form.field("b", { validator: new Counting("b") });
        // Un behavior encore en vol quand la validation des champs est finie :
        // c'est le seul cas où la convergence a quelque chose à rejuger.
        const c = form.field("c", {
            validator: new Counting("c"),
            behaviors: [lookup({
                field: "c",
                watch: ["a"],
                fetch: async () => { await wait(60); return "écrit pendant la soumission"; },
            })],
        });
        a.mount();
        b.mount();
        c.mount();
        form.mount();
        b.change("y");
        await wait(20);

        a.change("déclenche");
        await wait(5);
        const before = { ...runs };

        await form.submit();

        // `a` et `b` : une seule validation, celle de `field.submit()`.
        expect(runs.a - before.a).toBe(1);
        expect(runs.b - before.b).toBe(1);
        // `c` : sa valeur a été écrite pendant la convergence, donc rejugée.
        expect(runs.c - before.c).toBeGreaterThan(1);
        expect(c.snapshot.value).toBe("écrit pendant la soumission");
    });
});
