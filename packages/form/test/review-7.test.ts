import { describe, expect, it } from "vitest";
import {
    ExternalValidator,
    FormController,
    IValidator,
    type ValidationContext,
    type ValidationReport,
} from "../src/index";
import { until, wait } from "./helpers";

/** Rejette vite : simule une panne réseau transitoire sur une règle. */
class FastReject extends IValidator<string> {
    override readonly validateWhenEmpty = true;
    protected async validate(): Promise<void> {
        await wait(5);
        throw new Error("503");
    }
}

/** Refuse, mais lentement. */
class SlowRefusal extends IValidator<string> {
    override readonly validateWhenEmpty = true;
    protected async validate(_value: string, report: ValidationReport): Promise<void> {
        await wait(40);
        report.error("le serveur refuse cette valeur");
    }
}

describe("septième tour de revue", () => {
    it("un membre qui rejette n'efface pas le verdict d'un membre encore en vol", async () => {
        const form = new FormController<{ a: string }>({ name: "s1" });
        const field = form.field("a", { validator: [new FastReject(), new SlowRefusal()] });
        field.mount();
        form.mount();
        field.change("x");
        await until(() => field.snapshot.errors.length > 0, { timeout: 2000 });

        expect(field.snapshot.errors).toEqual(["le serveur refuse cette valeur"]);
        expect(field.snapshot.isBlocking).toBe(true);
        await expect(form.submit()).resolves.toBe(false);
    });

    it("un membre qui lève de façon synchrone n'empêche pas les suivants", async () => {
        const form = new FormController<{ a: string }>({ name: "s2" });
        class ThrowsSync extends IValidator<string> {
            override readonly validateWhenEmpty = true;
            protected validate(_v: string, _r: ValidationReport, ctx: ValidationContext): void {
                // Lecture d'une dépendance absente : erreur de programmation courante.
                ctx.watched("jamais déclaré");
            }
        }
        class Forbidden extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(value === "admin", "valeur interdite");
            }
        }
        const field = form.field("a", { validator: [new ThrowsSync(), new Forbidden()] });
        field.mount();
        form.mount();
        field.change("admin");
        await until(() => field.snapshot.errors.length > 0, { timeout: 2000 });

        expect(field.snapshot.errors).toEqual(["valeur interdite"]);
        await expect(form.submit()).resolves.toBe(false);
    });

    it("un membre qui lève ne produit aucun rejet non rattrapé", async () => {
        const rejections: unknown[] = [];
        const onRejection = (reason: unknown): void => void rejections.push(reason);
        process.on("unhandledRejection", onRejection);
        try {
            const form = new FormController<{ a: string }>({ name: "s3" });
            class ThrowsSync extends IValidator<string> {
                override readonly validateWhenEmpty = true;
                protected validate(): void {
                    throw new TypeError("lecture impossible");
                }
            }
            const field = form.field("a", { validator: [new FastReject(), new ThrowsSync()] });
            field.mount();
            form.mount();
            field.change("x");
            await wait(120);

            expect(rejections).toEqual([]);
        } finally {
            process.off("unhandledRejection", onRejection);
        }
    });

    it("le statut publié décrit toujours les constats publiés", async () => {
        const form = new FormController<{ a: string }>({ name: "s4" });
        let attempt = 0;
        class RefusesThenBreaks extends IValidator<string> {
            protected async validate(_value: string, report: ValidationReport): Promise<void> {
                attempt += 1;
                await wait(10);
                if (attempt === 1) {
                    report.error("refusé");
                    return;
                }
                throw new Error("réseau HS");
            }
        }
        const validator = new RefusesThenBreaks();
        const field = form.field("a", { validator });
        field.mount();
        form.mount();

        field.change("premier");
        await until(() => field.snapshot.errors.length > 0);
        expect(field.snapshot.validity).toBe("error");

        field.change("second");
        await wait(80);

        // Statut et constats viennent de la même passe : jamais « error » avec
        // zéro constat, jamais l'inverse.
        const state = validator.getState();
        if (state.status === "error") {
            expect(state.issues.length).toBeGreaterThan(0);
        } else {
            expect(state.errors).toEqual([]);
        }
        expect(validator.hasError).toBe(validator.firstError !== null);
        expect(field.snapshot.showError).toBe(field.snapshot.error !== undefined);
    });

    it("composer ne dispense pas un membre de déclarer ce qu'il lit", async () => {
        const form = new FormController<{ a: string; autre: string }>({ name: "s5" });
        let thrown: unknown;
        class Sneaky extends IValidator<string> {
            override readonly validateWhenEmpty = true;
            protected validate(_v: string, _r: ValidationReport, ctx: ValidationContext): void {
                try {
                    ctx.watched("autre");
                } catch (error) {
                    thrown = error;
                }
            }
        }
        // Le composite déclare `autre` par un AUTRE membre : le membre indiscret
        // ne doit pas en profiter.
        class Declares extends IValidator<string> {
            override readonly watch = ["autre"];
            protected validate(): void {
                // rien
            }
        }
        form.field("autre", {}).mount();
        const field = form.field("a", { validator: [new Sneaky(), new Declares()] });
        field.mount();
        form.mount();
        await wait(40);

        expect((thrown as Error | undefined)?.message).toMatch(/without declaring it in `watch`/);
    });

    it("un échec de règle est signalé, pas avalé", async () => {
        const seen: string[] = [];
        const original = console.error;
        console.error = (...args: unknown[]) => void seen.push(String(args[0]));
        try {
            const form = new FormController<{ a: string }>({ name: "s6" });
            const field = form.field("a", { validator: new FastReject() });
            field.mount();
            form.mount();
            field.change("x");
            await wait(80);
        } finally {
            console.error = original;
        }

        expect(seen.some((line) => line.includes("[slz]"))).toBe(true);
    });

    it("les constats serveur survivent à la panne d'une autre règle", async () => {
        const form = new FormController<{ email: string }>({ name: "s7" });
        const serverIssues = new ExternalValidator<string>();
        const field = form.field("email", { validator: [new FastReject(), serverIssues] });
        field.mount();
        form.mount();
        field.change("a@b.c");
        await wait(60);

        serverIssues.set([{ message: "Déjà pris", severity: "error", code: "taken" }]);
        await until(() => field.snapshot.errors.length > 0, { timeout: 2000 });

        expect(field.snapshot.errors).toEqual(["Déjà pris"]);
    });
});

describe("septième tour — coûts et restitutions", () => {
    it("la soumission ne rejuge que les champs dont la valeur a bougé", async () => {
        const form = new FormController<{ a: string; b: string; c: string }>({ name: "s8" });
        const counts = { a: 0, b: 0 };
        class Counting extends IValidator<string> {
            private readonly key: "a" | "b";
            constructor(key: "a" | "b") {
                super();
                this.key = key;
            }
            protected validate(): void {
                counts[this.key] += 1;
            }
        }
        const slow: IValidator<string> = new (class extends IValidator<string> {
            protected async validate(): Promise<void> {
                await wait(40);
            }
        })();

        const a = form.field("a", { validator: new Counting("a") });
        const b = form.field("b", { validator: new Counting("b") });
        const c = form.field("c", { validator: slow });
        a.mount();
        b.mount();
        c.mount();
        form.mount();
        a.change("x");
        b.change("y");
        c.change("z");
        await until(() => !c.isBusy, { timeout: 2000 });

        const before = { ...counts };
        c.change("relance");
        await form.submit();

        // `c` est en vol pendant la soumission ; `a` et `b` n'ont pas bougé et
        // ne doivent pas être revalidés une seconde fois.
        expect(counts.a - before.a).toBeLessThanOrEqual(1);
        expect(counts.b - before.b).toBeLessThanOrEqual(1);
    });

    it("récupérer un champ lui rend aussi sa modifiabilité", async () => {
        const form = new FormController<{ a: string }>({ name: "s9", settleTimeout: 40 });
        const field = form.field("a", {
            behaviors: [{
                onMount: async (ctx) => {
                    ctx.push(ctx.state.loading().readOnly());
                    return new Promise<never>(() => undefined);
                },
            }],
        });
        field.mount();
        form.mount();
        await wait(20);
        expect(field.snapshot.isReadOnly).toBe(true);

        await form.submit();
        expect(field.snapshot.isReadOnly).toBe(false);
    });

    it("abandonner une validation écarte son résultat tardif", async () => {
        const form = new FormController<{ a: string }>({ name: "s10" });
        class LateRefusal extends IValidator<string> {
            protected async validate(_value: string, report: ValidationReport): Promise<void> {
                await wait(60);
                report.error("verdict tardif");
            }
        }
        const field = form.field("a", { validator: new LateRefusal() });
        field.mount();
        form.mount();
        field.change("x");
        await until(() => field.snapshot.isLoading, { timeout: 1000 });

        field.recover();
        await wait(120);

        // Le run abandonné ne doit pas publier son verdict après coup.
        expect(field.snapshot.errors).toEqual([]);
        expect(field.snapshot.isLoading).toBe(false);
    });
});
