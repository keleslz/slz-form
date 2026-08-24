import { describe, expect, it } from "vitest";
import {
    behaviorsFor,
    DebouncedValidator,
    FormController,
    hideWhen,
    IValidator,
    type FieldArray,
    type IBehavior,
    type ValidationReport,
} from "../src/index";
import { until, wait } from "./helpers";

/**
 * Propriétés que le moteur revendique et qu'aucun test ne tenait : une campagne
 * de mutation les a montrées supprimables sans faire échouer la suite.
 */
describe("propriétés revendiquées", () => {
    it("quitter un champ le marque touché", () => {
        const form = new FormController<{ a: string }>({ name: "c1" });
        const field = form.field("a", {});
        field.mount();
        form.mount();

        expect(field.snapshot.hasFlag("touched")).toBe(false);
        field.blur();
        expect(field.snapshot.hasFlag("touched")).toBe(true);
    });

    it("soumettre fait partir la validation différée sans attendre son délai", async () => {
        const form = new FormController<{ a: string }>({ name: "c2" });
        let runs = 0;
        class Counting extends IValidator<string> {
            protected validate(_value: string, report: ValidationReport): void {
                runs += 1;
                report.error("refusé");
            }
        }
        const field = form.field("a", { validator: new DebouncedValidator(new Counting(), 500) });
        field.mount();
        form.mount();
        field.change("x");
        await wait(30);
        expect(runs).toBe(0);

        await expect(form.submit()).resolves.toBe(false);
        expect(runs).toBeGreaterThan(0);
    });

    it("remonter un champ lui redonne un signal vivant", async () => {
        const form = new FormController<{ a: string }>({ name: "c3" });
        let ranAfterRemount = false;
        const behavior: IBehavior<string> = {
            onMount: async (ctx) => {
                await wait(10);
                if (!ctx.signal.aborted) {
                    ranAfterRemount = true;
                    ctx.setValue("posé");
                }
                return ctx.state;
            },
        };
        const field = form.field("a", { behaviors: [behavior] });
        field.mount();
        field.unmount();
        ranAfterRemount = false;
        field.mount();
        form.mount();
        await until(() => ranAfterRemount, { timeout: 1000 });

        expect(field.snapshot.value).toBe("posé");
    });

    it("démonter un champ prévient ses behaviors", () => {
        const form = new FormController<{ a: string }>({ name: "c4" });
        let unmounted = 0;
        const behavior: IBehavior<string> = { onUnmount: () => { unmounted += 1; } };
        const field = form.field("a", { behaviors: [behavior] });
        field.mount();
        form.mount();

        field.unmount();
        expect(unmounted).toBe(1);
    });

    it("un behavior ne peut pas lire un champ qu'il n'a pas déclaré", async () => {
        const form = new FormController<{ a: string; autre: string }>({ name: "c5" });
        let thrown: unknown;
        const sneaky: IBehavior<string> = {
            onMount: (ctx) => {
                try {
                    ctx.watched("autre");
                } catch (error) {
                    thrown = error;
                }
            },
        };
        form.field("autre", {}).mount();
        form.field("a", { behaviors: [sneaky] }).mount();
        form.mount();
        await wait(20);

        expect((thrown as Error | undefined)?.message).toMatch(/without declaring it in `watch`/);
    });

    it("le message d'obligation est celui qu'on a fourni", async () => {
        const form = new FormController<{ a: string }>({ name: "c6" });
        const field = form.field("a", { required: true, requiredMessage: "Merci de renseigner ce champ" });
        field.mount();
        form.mount();
        field.blur();
        await until(() => field.snapshot.errors.length > 0);

        expect(field.snapshot.errors).toEqual(["Merci de renseigner ce champ"]);
    });

    it("une chaîne de dépendances qui n'en finit pas est arrêtée", () => {
        const form = new FormController<Record<string, string>>({ name: "c7" });
        const copy = (from: string): IBehavior<string> => ({
            watch: [from],
            onDependencyChanged: (ctx, dependency) => {
                ctx.setValue(`${String(dependency.value)}+`);
            },
        });

        const source = form.field("f0", {});
        source.mount();
        for (let index = 1; index <= 60; index += 1) {
            form.field(`f${index}`, { behaviors: [copy(`f${index - 1}`)] }).mount();
        }
        form.mount();

        expect(() => source.change("x")).toThrow(/ne converge pas/);
    });

    it("les champs sont verrouillés pendant la soumission", async () => {
        const form = new FormController<{ a: string }>({ name: "c8" });
        const slow: IBehavior<string> = {
            onSubmit: async (ctx) => {
                ctx.push(ctx.state.loading());
                await wait(30);
                return ctx.state.idle();
            },
        };
        const field = form.field("a", { behaviors: [slow] });
        field.mount();
        form.mount();

        const pending = form.submit();
        await until(() => field.snapshot.hasFlag("locked"));
        expect(form.getSnapshot().hasFlag("submitting")).toBe(true);

        await pending;
        expect(field.snapshot.hasFlag("locked")).toBe(false);
    });

    it("une ligne invalide fait échouer la soumission du formulaire", async () => {
        type Fields = { rows: FieldArray<{ label: string }> };
        const form = new FormController<Fields>({ name: "c9" });
        const rows = form.array("rows");
        form.mount();

        const id = rows.append();
        rows.row(id)?.field("label", { required: true }).mount();
        await wait(20);

        await expect(form.submit()).resolves.toBe(false);
    });

    it("la soumission attend une valeur écrite en vol, et la juge", async () => {
        const form = new FormController<{ src: string; dst: string }>({ name: "c10" });
        const { lookup } = behaviorsFor(form);
        class NoDigit extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(/\d/.test(value), "pas de chiffre");
            }
        }
        const source = form.field("src", {});
        const target = form.field("dst", {
            validator: new NoDigit(),
            behaviors: [lookup({
                field: "dst",
                watch: ["src"],
                fetch: async () => { await wait(30); return "valeur42"; },
            })],
        });
        source.mount();
        target.mount();
        form.mount();
        source.change("go");

        await expect(form.submit()).resolves.toBe(false);
        expect(target.snapshot.value).toBe("valeur42");
        expect(target.snapshot.errors).toEqual(["pas de chiffre"]);
    });

    it("reset() ramène le formulaire à l'état de repos", async () => {
        const form = new FormController<{ a: string }>({ name: "c11" });
        const field = form.field("a", {});
        field.mount();
        form.mount();
        field.change("x");
        await expect(form.submit()).resolves.toBe(true);
        expect(form.snapshot.status).toBe("submitted");

        form.reset();
        expect(form.snapshot.status).toBe("idle");
    });

    it("clear() démonte les lignes qu'il retire", () => {
        type Fields = { rows: FieldArray<{ label: string }> };
        const form = new FormController<Fields>({ name: "c12" });
        const rows = form.array("rows");
        form.mount();

        const id = rows.append();
        const row = rows.row(id);
        rows.clear();

        expect(rows.rows).toHaveLength(0);
        expect(row?.form.isUnmounted).toBe(true);
    });

    it("resetOnReload vide la sélection devenue caduque", async () => {
        const form = new FormController<{ brand: string; model: string }>({ name: "c13" });
        const { loadOptions } = behaviorsFor(form);
        const brand = form.field("brand", {});
        const model = form.field("model", {
            behaviors: [loadOptions({
                field: "model",
                watch: ["brand"],
                on: ["dependency"],
                fetch: async ({ brand: chosen }) => [{ value: `${String(chosen)}-1`, label: "Un" }],
            })],
        });
        brand.mount();
        model.mount();
        form.mount();

        brand.change("a");
        await until(() => model.snapshot.options.length > 0);
        model.change("a-1");
        expect(model.snapshot.value).toBe("a-1");

        brand.change("b");
        await until(() => model.snapshot.options[0]?.value === "b-1");
        expect(model.snapshot.value).toBeUndefined();
    });

    it("le hideWhen exporté émet bien invisible", async () => {
        const form = new FormController<{ src: string; dst: string }>({ name: "c14" });
        const source = form.field("src", {});
        const target = form.field("dst", {
            behaviors: [hideWhen(["src"], (view) => view.field("src")?.value === "cacher")],
        });
        source.mount();
        target.mount();
        form.mount();
        await wait(20);
        expect(target.snapshot.hasFlag("invisible")).toBe(false);

        source.change("cacher");
        await until(() => target.snapshot.hasFlag("invisible"));
        expect(target.snapshot.hasFlag("invisible")).toBe(true);
    });
});
