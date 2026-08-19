import { describe, expect, it } from "vitest";
import {
    behaviorsFor,
    ExternalValidator,
    FormController,
    IValidator,
    type FieldArray,
    type IBehavior,
    type ValidationContext,
    type ValidationReport,
} from "../src/index";
import { until, wait } from "./helpers";

class Passing extends IValidator<string> {
    protected validate(): void {
        // aucune règle
    }
}

describe("quatrième tour de revue", () => {
    it("une validation qui ne retombe jamais ne condamne pas le formulaire", async () => {
        const form = new FormController<{ a: string }>({ name: "q1", settleTimeout: 40 });
        class NeverResolves extends IValidator<string> {
            protected validate(): Promise<void> {
                return new Promise<void>(() => undefined);
            }
        }
        const field = form.field("a", { validator: new NeverResolves() });
        field.mount();
        form.mount();
        field.change("x");
        await wait(20);

        const started = Date.now();
        await expect(form.submit()).resolves.toBe(false);

        expect(Date.now() - started).toBeLessThan(2000);
        expect(form.snapshot.status).not.toBe("submitting");
        expect(field.snapshot.isLocked).toBe(false);
    });

    it("une garde du moteur pendant la soumission laisse le formulaire utilisable", async () => {
        const form = new FormController<{ a: string; autre: string }>({ name: "q2" });
        class ReadsUndeclared extends IValidator<string> {
            protected validate(_v: string, _r: ValidationReport, ctx: ValidationContext): void {
                ctx.watched("autre");
            }
        }
        form.field("autre", {}).mount();
        const field = form.field("a", { validator: new ReadsUndeclared() });
        field.mount();
        form.mount();
        await wait(20);

        await form.submit();

        expect(form.snapshot.status).not.toBe("submitting");
        expect(field.snapshot.isLocked).toBe(false);
        await expect(form.submit()).resolves.toBeTypeOf("boolean");
    });

    it("aucune interaction ne produit de rejet non rattrapé", async () => {
        const rejections: unknown[] = [];
        const onRejection = (reason: unknown): void => void rejections.push(reason);
        process.on("unhandledRejection", onRejection);
        try {
            const form = new FormController<{ a: string; autre: string }>({ name: "q3" });
            class Throws extends IValidator<string> {
                protected validate(_v: string, _r: ValidationReport, ctx: ValidationContext): void {
                    ctx.watched("autre");
                }
            }
            form.field("autre", {}).mount();
            const field = form.field("a", { validator: new Throws() });
            field.mount();
            form.mount();

            field.change("x");
            field.blur();
            form.reset();
            await wait(80);

            expect(rejections).toEqual([]);
        } finally {
            process.off("unhandledRejection", onRejection);
        }
    });

    it("partager un validator entre deux lignes d'une liste est refusé", () => {
        type Row = { label: string };
        const form = new FormController<{ lines: FieldArray<Row> }>({ name: "q4" });
        const lines = form.array("lines");
        form.mount();

        const shared = new Passing();
        const first = lines.append();
        const second = lines.append();
        lines.row(first)?.field("label", { validator: shared }).mount();

        expect(() => lines.row(second)?.field("label", { validator: shared }).mount())
            .toThrow(/cannot be shared/);
    });

    it("un membre de composite partagé revalide tous les champs qui le portent", async () => {
        const form = new FormController<{ email: string; phone: string }>({ name: "q5" });
        const serverIssues = new ExternalValidator<string>();
        const email = form.field("email", { validator: [serverIssues, new Passing()] });
        const phone = form.field("phone", { validator: [serverIssues, new Passing()] });
        email.mount();
        phone.mount();
        form.mount();
        email.change("a@b.c");
        phone.change("0102030405");
        await wait(20);

        serverIssues.set([{ message: "compte déjà existant", severity: "error" }]);
        await until(() => email.snapshot.errors.length > 0 && phone.snapshot.errors.length > 0);

        expect(email.snapshot.errors).toEqual(["compte déjà existant"]);
        expect(phone.snapshot.errors).toEqual(["compte déjà existant"]);
    });

    it("reset() efface aussi les constats injectés", async () => {
        const form = new FormController<{ email: string }>({ name: "q6" });
        const serverIssues = new ExternalValidator<string>();
        const field = form.field("email", { validator: [serverIssues, new Passing()] });
        field.mount();
        form.mount();
        field.change("a@b.c");
        await wait(20);

        serverIssues.set([{ message: "déjà pris", severity: "error" }]);
        await until(() => field.snapshot.errors.length > 0);

        form.reset();
        await until(() => field.snapshot.errors.length === 0);
        expect(form.snapshot.isValid).toBe(true);
    });

    it("un validator peut s'annuler au démontage du champ", async () => {
        const form = new FormController<{ a: string }>({ name: "q7" });
        let writesAfterUnmount = 0;
        class Networked extends IValidator<string> {
            protected async validate(_v: string, report: ValidationReport, ctx: ValidationContext): Promise<void> {
                await wait(40);
                if (ctx.signal.aborted) {
                    return;
                }
                writesAfterUnmount += 1;
                report.error("verdict tardif");
            }
        }
        const field = form.field("a", { validator: new Networked() });
        field.mount();
        form.mount();
        field.change("x");
        await wait(10);
        field.unmount();
        await wait(100);

        expect(writesAfterUnmount).toBe(0);
    });

    it("une soumission ne valide qu'une fois quand rien n'est en vol", async () => {
        const form = new FormController<{ a: string }>({ name: "q8" });
        let runs = 0;
        class Counting extends IValidator<string> {
            protected validate(): void {
                runs += 1;
            }
        }
        const field = form.field("a", { validator: new Counting() });
        field.mount();
        form.mount();
        field.change("x");
        await wait(20);

        const before = runs;
        await form.submit();
        expect(runs - before).toBe(1);
    });

    it("une valeur non sérialisable ne fait pas lever la détection de changement", () => {
        type Row = { payload: unknown };
        const form = new FormController<{ rows: FieldArray<Row> }>({ name: "q9" });
        const rows = form.array("rows");
        form.mount();

        const circular: Record<string, unknown> = {};
        circular.self = circular;

        const id = rows.append();
        const field = rows.row(id)?.field("payload");
        field?.mount();

        expect(() => field?.change(circular)).not.toThrow();
        expect(() => field?.change(BigInt(9))).not.toThrow();
    });

    it("un fichier remplacé par un autre est bien vu comme un changement", async () => {
        type Row = { file: unknown };
        type Fields = { audit: string; rows: FieldArray<Row> };
        const form = new FormController<Fields>({ name: "q10" });
        const { lookup } = behaviorsFor(form);
        let calls = 0;
        const rows = form.array("rows");
        form.field("audit", {
            behaviors: [lookup({
                field: "audit",
                watch: ["rows"],
                fetch: async () => { calls += 1; return "v"; },
            })],
        }).mount();
        form.mount();

        const id = rows.append();
        const field = rows.row(id)?.field("file");
        field?.mount();
        field?.change({ name: "contrat.pdf" });
        await wait(30);
        const afterFirst = calls;

        // Deux objets opaques à JSON, mais bien distincts.
        field?.change({ name: "virus.exe" });
        await wait(30);

        expect(calls).toBeGreaterThan(afterFirst);
    });

    it("un behavior qui lève n'empêche pas la revalidation du champ", async () => {
        const form = new FormController<{ a: string }>({ name: "q11" });
        const faulty: IBehavior<string> = {
            onChange: () => {
                throw new Error("behavior fautif");
            },
        };
        class Refuses extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(value === "bad", "refusé");
            }
        }
        const field = form.field("a", { behaviors: [faulty], validator: new Refuses() });
        field.mount();
        form.mount();

        expect(() => field.change("bad")).not.toThrow();
        await until(() => field.snapshot.errors.length > 0);
        expect(field.snapshot.validity).toBe("error");
    });

    it("une validation asynchrone en vol met le champ en loading", async () => {
        const form = new FormController<{ a: string }>({ name: "q12" });
        class Slow extends IValidator<string> {
            protected async validate(): Promise<void> {
                await wait(60);
            }
        }
        const field = form.field("a", { validator: new Slow() });
        field.mount();
        form.mount();

        field.change("x");
        await until(() => field.snapshot.isLoading);
        expect(field.snapshot.isLoading).toBe(true);
        expect(field.isBusy).toBe(true);

        await until(() => !field.snapshot.isLoading);
        expect(field.isBusy).toBe(false);
    });

    it("réécrire la même valeur ne relance rien", async () => {
        const form = new FormController<{ a: string }>({ name: "q13" });
        let runs = 0;
        class Counting extends IValidator<string> {
            protected validate(): void {
                runs += 1;
            }
        }
        const field = form.field("a", { validator: new Counting() });
        field.mount();
        form.mount();
        field.change("x");
        await wait(20);

        const before = runs;
        field.change("x");
        await wait(20);
        expect(runs).toBe(before);
    });

    it("une réponse de loadOptions périmée ne rend pas la main sur l'attente", async () => {
        const form = new FormController<{ src: string; list: string }>({ name: "q14" });
        const { loadOptions } = behaviorsFor(form);
        let call = 0;
        const source = form.field("src", {});
        const list = form.field("list", {
            behaviors: [loadOptions({
                field: "list",
                watch: ["src"],
                on: ["dependency"],
                fetch: async () => {
                    call += 1;
                    const mine = call;
                    await wait(mine === 1 ? 20 : 160);
                    return [{ value: `appel-${mine}`, label: `L${mine}` }];
                },
            })],
        });
        source.mount();
        list.mount();
        form.mount();

        source.change("a");
        await wait(5);
        source.change("b");
        await wait(70);

        // Le run frais est encore en vol : le champ doit rester occupé.
        expect(list.isBusy).toBe(true);

        await until(() => !list.isBusy, { timeout: 3000 });
        expect(list.snapshot.options.map((option) => option.value)).toEqual(["appel-2"]);
    });
});
