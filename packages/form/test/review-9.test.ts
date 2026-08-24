import { describe, expect, it } from "vitest";
import {
    DebouncedValidator,
    FormController,
    IValidator,
    type ValidationReport,
} from "../src/index";
import { until, wait } from "./helpers";

class Noop extends IValidator<string> {
    protected validate(): void {
        // aucune règle
    }
}

/** Accepte, jusqu'à ce que le test déclare le réseau tombé. */
class BreaksOnDemand extends IValidator<string> {
    broken = false;
    protected async validate(): Promise<void> {
        await wait(5);
        if (this.broken) {
            throw new Error("503");
        }
    }
}

describe("neuvième tour de revue", () => {
    it("une valeur qu'aucune règle n'a pu juger n'est pas soumise", async () => {
        for (const [label, wrap] of [
            ["seul", (rule: BreaksOnDemand) => rule],
            ["composé", (rule: BreaksOnDemand) => [rule, new Noop()]],
            ["différé", (rule: BreaksOnDemand) => new DebouncedValidator(rule, 5)],
            ["différé et composé", (rule: BreaksOnDemand) => [new DebouncedValidator(rule, 5), new Noop()]],
        ] as const) {
            const form = new FormController<{ email: string }>({ name: `n1-${label}` });
            const rule = new BreaksOnDemand();
            const field = form.field("email", { validator: wrap(rule) });
            field.mount();
            form.mount();

            field.change("libre@x.com");
            await until(() => field.snapshot.ui.validity === "valid", { timeout: 2000 });
            await expect(form.submit(), label).resolves.toBe(true);

            // La vérification distante casse : la nouvelle valeur n'est jugée
            // par personne. La déclarer valide laisserait passer ce que la
            // règle aurait peut-être refusé.
            rule.broken = true;
            field.change("doublon@x.com");
            await until(() => !field.isBusy, { timeout: 2000 });

            expect(field.snapshot.errors.length > 0, label).toBe(true);
            await expect(form.submit(), label).resolves.toBe(false);
        }
    });

    it("un refus antérieur ne se recolle pas à une valeur corrigée", async () => {
        const form = new FormController<{ email: string }>({ name: "n2" });
        let calls = 0;
        class RefusesThenBreaks extends IValidator<string> {
            protected async validate(_value: string, report: ValidationReport): Promise<void> {
                calls += 1;
                await wait(5);
                if (calls === 1) {
                    report.error("déjà pris", { code: "taken" });
                    return;
                }
                throw new Error("503");
            }
        }
        const field = form.field("email", { validator: new RefusesThenBreaks() });
        field.mount();
        form.mount();

        field.change("ada@x.com");
        await until(() => field.snapshot.errors.length > 0, { timeout: 2000 });
        expect(field.snapshot.errors).toEqual(["déjà pris"]);

        field.change("grace@x.com");
        await until(() => !field.isBusy, { timeout: 2000 });

        // La valeur corrigée n'est pas jugée : elle bloque, mais pas avec le
        // message d'une autre saisie.
        expect(field.snapshot.errors.length > 0).toBe(true);
        expect(field.snapshot.errors).not.toContain("déjà pris");
    });

    it("un champ rempli ne porte jamais le message d'obligation", async () => {
        const form = new FormController<{ email: string }>({ name: "n3" });
        let calls = 0;
        class Breaks extends IValidator<string> {
            protected async validate(): Promise<void> {
                calls += 1;
                await wait(5);
                if (calls > 1) {
                    throw new Error("503");
                }
            }
        }
        const field = form.field("email", { required: true, validator: new Breaks() });
        field.mount();
        form.mount();

        field.change("premier@x.com");
        await until(() => field.snapshot.ui.validity === "valid", { timeout: 2000 });

        field.change("rempli@x.com");
        await until(() => !field.isBusy, { timeout: 2000 });

        expect(field.snapshot.errors).not.toContain("This field is required");
    });

    it("un avertissement posé avant une panne est conservé", async () => {
        const form = new FormController<{ a: string }>({ name: "n4" });
        class WarnsThenBreaks extends IValidator<string> {
            protected async validate(_value: string, report: ValidationReport): Promise<void> {
                report.warn("code postal inhabituel", { code: "unusual" });
                await wait(5);
                throw new Error("503");
            }
        }
        const field = form.field("a", { validator: new WarnsThenBreaks() });
        field.mount();
        form.mount();
        field.change("13001");
        await until(() => !field.isBusy, { timeout: 2000 });

        expect(field.snapshot.warnings).toEqual(["code postal inhabituel"]);
    });

    it("une règle qui gère sa propre panne garde la main", async () => {
        const form = new FormController<{ a: string }>({ name: "n5" });
        class Tolerant extends IValidator<string> {
            protected async validate(_value: string, report: ValidationReport): Promise<void> {
                try {
                    await wait(5);
                    throw new Error("503");
                } catch {
                    report.warn("Vérification indisponible", { code: "offline" });
                }
            }
        }
        const field = form.field("a", { validator: new Tolerant() });
        field.mount();
        form.mount();
        field.change("x");
        await until(() => !field.isBusy, { timeout: 2000 });

        // La règle a conclu : elle avertit sans bloquer, et la soumission passe.
        expect(field.snapshot.errors.length > 0).toBe(false);
        expect(field.snapshot.warnings).toEqual(["Vérification indisponible"]);
        await expect(form.submit()).resolves.toBe(true);
    });

    it("le constat d'indisponibilité porte un code, pour être routé", async () => {
        const form = new FormController<{ a: string }>({ name: "n6" });
        class Breaks extends IValidator<string> {
            protected async validate(): Promise<void> {
                await wait(5);
                throw new Error("503");
            }
        }
        const field = form.field("a", { validator: new Breaks() });
        field.mount();
        form.mount();
        field.change("x");
        await until(() => field.snapshot.errors.length > 0, { timeout: 2000 });

        expect(field.snapshot.issues.map((issue) => issue.code)).toContain("unverified");
    });

    it("un membre qui lève de façon synchrone interrompt bien la passe", async () => {
        const form = new FormController<{ a: string }>({ name: "n7" });
        class ThrowsSync extends IValidator<string> {
            protected validate(): void {
                throw new TypeError("règle cassée");
            }
        }
        const field = form.field("a", { validator: [new ThrowsSync(), new Noop()] });
        field.mount();
        form.mount();
        field.change("x");
        await until(() => !field.isBusy, { timeout: 2000 });

        expect(field.snapshot.errors.length > 0).toBe(true);
        await expect(form.submit()).resolves.toBe(false);
    });

    it("une remise à zéro invalide le jeton de run", async () => {
        const form = new FormController<{ a: string }>({ name: "n8" });
        class Late extends IValidator<string> {
            protected async validate(_value: string, report: ValidationReport): Promise<void> {
                await wait(60);
                report.error("verdict tardif");
            }
        }
        const validator = new Late();
        const field = form.field("a", { validator });
        field.mount();
        form.mount();
        field.change("x");
        await until(() => field.snapshot.hasFlag("loading"), { timeout: 1000 });

        validator.reset();
        await wait(120);
        expect(validator.getState().issues).toEqual([]);
    });
});

describe("neuvième tour — fuites et partage", () => {
    it("un validator différé ne laisse pas d'abonné sur la règle décorée", async () => {
        const { ExternalValidator: External } = await import("../src/index");
        const shared = new External<string>();
        let subscribers = 0;
        const realOnStale = shared.onStale.bind(shared);
        shared.onStale = (listener) => {
            subscribers += 1;
            const off = realOnStale(listener);
            return () => { subscribers -= 1; off(); };
        };

        for (let index = 0; index < 20; index += 1) {
            const form = new FormController<{ a: string }>({ name: `n9-${index}` });
            const field = form.field("a", { validator: new DebouncedValidator(shared, 5) });
            field.mount();
            form.mount();
            await wait(1);
            field.unmount();
        }

        expect(subscribers).toBe(0);
    });

    it("les quatre écritures d'une même règle se comportent identiquement", async () => {
        class Refuses extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(value === "non", "refusé");
            }
        }
        const results: string[] = [];

        for (const wrap of [
            (rule: IValidator<string>) => rule,
            (rule: IValidator<string>) => [rule, new Noop()],
            (rule: IValidator<string>) => new DebouncedValidator(rule, 5),
            (rule: IValidator<string>) => [new DebouncedValidator(rule, 5), new Noop()],
        ]) {
            const form = new FormController<{ a: string }>({ name: `n10-${results.length}` });
            const field = form.field("a", { validator: wrap(new Refuses()) });
            field.mount();
            form.mount();
            field.change("non");
            await until(() => field.snapshot.errors.length > 0, { timeout: 2000 });
            results.push(field.snapshot.errors.join("|"));
        }

        expect(new Set(results).size).toBe(1);
        expect(results[0]).toBe("refusé");
    });
});
