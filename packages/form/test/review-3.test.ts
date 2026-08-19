import { describe, expect, it } from "vitest";
import {
    behaviorsFor,
    DebouncedValidator,
    ExternalValidator,
    FormController,
    IValidator,
    type FieldArray,
    type IBehavior,
    type ValidationContext,
    type ValidationReport,
} from "../src/index";
import { until, wait } from "./helpers";

describe("troisième tour de revue", () => {
    it("un validator asynchrone qui rejette ne fige ni le champ ni le formulaire", async () => {
        const form = new FormController<{ a: string }>({ name: "t1" });
        class Rejecting extends IValidator<string> {
            protected async validate(): Promise<void> {
                await wait(5);
                throw new Error("réseau HS");
            }
        }
        const field = form.field("a", { validator: new Rejecting() });
        field.mount();
        form.mount();
        field.change("x");
        await wait(60);

        expect(field.snapshot.isLoading).toBe(false);
        expect(field.isBusy).toBe(false);
        // La valeur n'est pas jugée, donc elle bloque — mais rien n'est figé :
        // la soumission rend un booléen et le formulaire reste utilisable.
        await expect(form.submit()).resolves.toBe(false);
        expect(form.snapshot.status).not.toBe("submitting");
        await expect(form.submit()).resolves.toBeTypeOf("boolean");
    });

    it("un validator peut lire une liste déclarée dans son watch", async () => {
        type Deal = { total: string; parts: FieldArray<{ share: number }> };
        let seen: unknown = "jamais appelé";
        class Reads extends IValidator<string> {
            override readonly watch = ["parts"];
            override readonly validateWhenEmpty = true;
            protected validate(_value: string, _report: ValidationReport, ctx: ValidationContext): void {
                seen = ctx.watched("parts")?.value;
            }
        }
        const form = new FormController<Deal>({ name: "t2" });
        const parts = form.array("parts");
        form.field("total", { validator: new Reads() }).mount();
        form.mount();

        const id = parts.append();
        parts.row(id)?.field("share").mount();
        parts.row(id)?.field("share").change(7);
        await wait(50);

        expect(seen).toEqual([{ share: 7 }]);
    });

    it("monter ou toucher un champ de ligne ne relance pas ce qui observe la liste", async () => {
        type Fields = { hint: string; rows: FieldArray<{ code: string }> };
        const form = new FormController<Fields>({ name: "t3" });
        const { lookup } = behaviorsFor(form);
        let calls = 0;
        const rows = form.array("rows");
        form.field("hint", {
            behaviors: [lookup({ field: "hint", watch: ["rows"], fetch: async () => { calls += 1; return "v"; } })],
        }).mount();
        form.mount();

        const id = rows.append();
        await wait(20);
        const afterAppend = calls;

        rows.row(id)?.field("code").mount();
        rows.row(id)?.field("code").blur();
        await wait(30);

        expect(calls).toBe(afterAppend);
    });

    it("lockUntilValid déverrouille quand un prefill rend la dépendance valide", async () => {
        const form = new FormController<{ src: string; dst: string }>({ name: "t4" });
        const { lockUntilValid, prefill } = behaviorsFor(form);
        const src = form.field("src", {
            required: true,
            behaviors: [prefill({ field: "src", fetch: async () => { await wait(20); return "rempli"; } })],
        });
        const dst = form.field("dst", { behaviors: [lockUntilValid({ watch: ["src"] })] });
        src.mount();
        dst.mount();
        form.mount();
        expect(dst.snapshot.isLocked).toBe(true);

        await until(() => !src.snapshot.isBlocking, { timeout: 2000 });
        await until(() => !dst.snapshot.isLocked, { timeout: 2000 });
        // Aucune interaction utilisateur : `src` reste `pristine` à l'affichage,
        // mais son verdict a changé, et c'est lui qui compte.
        expect(src.snapshot.validity).toBe("pristine");
        expect(src.snapshot.isBlocking).toBe(false);
        expect(dst.snapshot.isLocked).toBe(false);
    });

    it("partager une instance de validator entre deux champs est refusé", () => {
        const form = new FormController<{ a: string; b: string }>({ name: "t5" });
        class MinLength extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(value.length < 3, "trop court");
            }
        }
        const shared = new MinLength();
        form.field("a", { validator: shared }).mount();

        expect(() => form.field("b", { validator: shared }).mount()).toThrow(/cannot be shared/);
    });

    it("un validator différé relaie les constats injectés", async () => {
        const form = new FormController<{ e: string }>({ name: "t6" });
        const serverIssues = new ExternalValidator<string>();
        const field = form.field("e", { validator: new DebouncedValidator(serverIssues, 5) });
        field.mount();
        form.mount();
        field.change("x");
        await wait(30);

        serverIssues.set([{ message: "422 du serveur", severity: "error" }]);
        await wait(60);

        expect(field.snapshot.errors).toEqual(["422 du serveur"]);
    });

    it("un champ démonté ne laisse pas d'abonné sur un membre partagé", async () => {
        const shared = new ExternalValidator<string>();
        let subscribers = 0;
        const realOnStale = shared.onStale.bind(shared);
        shared.onStale = (listener) => {
            subscribers += 1;
            const off = realOnStale(listener);
            return () => { subscribers -= 1; off(); };
        };

        for (let index = 0; index < 20; index += 1) {
            const form = new FormController<{ a: string }>({ name: `t7-${index}` });
            const field = form.field("a", { validator: [shared, new ExternalValidator<string>()] });
            field.mount();
            form.mount();
            await wait(1);
            field.unmount();
        }

        expect(subscribers).toBe(0);
    });

    it("le snapshot d'un champ garde la même référence quand rien ne change", () => {
        const form = new FormController<{ a: string }>({ name: "t8" });
        const field = form.field("a", {});
        field.mount();
        form.mount();

        field.change("x");
        const before = field.snapshot;
        field.change("x");

        expect(field.snapshot).toBe(before);
    });

    it("le snapshot du formulaire garde la même référence quand rien ne change", () => {
        const form = new FormController<{ a: string }>({ name: "t9" });
        const field = form.field("a", {});
        field.mount();
        form.mount();
        field.change("x");

        const before = form.snapshot;
        field.change("x");

        expect(form.snapshot).toBe(before);
    });

    it("quitter un champ fait partir la validation différée sans attendre le délai", async () => {
        const form = new FormController<{ a: string }>({ name: "t10" });
        let calls = 0;
        class Slow extends IValidator<string> {
            protected validate(_value: string, report: ValidationReport): void {
                calls += 1;
                report.error("toujours faux");
            }
        }
        const field = form.field("a", { validator: new DebouncedValidator(new Slow(), 400) });
        field.mount();
        form.mount();

        field.change("ab");
        await wait(30);
        expect(calls).toBe(0);

        field.blur();
        await wait(40);
        expect(calls).toBe(1);
        expect(field.snapshot.errors).toEqual(["toujours faux"]);
    });

    it("la saisie de l'utilisateur gagne sur une réponse tardive de lookup", async () => {
        const form = new FormController<{ src: string; city: string }>({ name: "t11" });
        const { lookup } = behaviorsFor(form);
        const source = form.field("src", {});
        const city = form.field("city", {
            behaviors: [lookup({
                field: "city",
                watch: ["src"],
                fetch: async () => { await wait(40); return "réponse tardive"; },
            })],
        });
        source.mount();
        city.mount();
        form.mount();

        source.change("a");
        await wait(10);
        city.change("saisie de l'utilisateur");
        await wait(80);

        expect(city.snapshot.value).toBe("saisie de l'utilisateur");
    });

    it("le verdict précédent est conservé pendant une revalidation", async () => {
        const form = new FormController<{ a: string }>({ name: "t12" });
        class SlowFail extends IValidator<string> {
            protected async validate(_value: string, report: ValidationReport): Promise<void> {
                await wait(30);
                report.error("invalide");
            }
        }
        const field = form.field("a", { validator: new SlowFail() });
        field.mount();
        form.mount();

        field.change("x");
        await wait(60);
        expect(field.snapshot.validity).toBe("error");

        field.change("y");
        await wait(10);
        expect(field.snapshot.validity).toBe("error");
    });

    it("append() monte la ligne quand le formulaire est monté", async () => {
        type Fields = { rows: FieldArray<{ label: string }> };
        const form = new FormController<Fields>({ name: "t13" });
        const rows = form.array("rows");
        form.mount();

        const id = rows.append();
        const row = rows.row(id);
        // Montée par `append()`, sans que personne s'en occupe.
        expect(row?.form.isMounted).toBe(true);

        const field = row?.field("label", { required: true });
        field?.mount();
        await wait(20);
        expect(form.snapshot.isValid).toBe(false);

        // Une ligne ajoutée à un formulaire monté est vivante : son propre
        // `values()` répond, et un champ créé après coup s'y rattache.
        field?.change("posé");
        await wait(20);
        expect(row?.values()).toEqual({ label: "posé" });
    });

    it("form.isBusy tient compte des lignes", async () => {
        type Fields = { rows: FieldArray<{ a: string }> };
        const form = new FormController<Fields>({ name: "t14" });
        const rows = form.array("rows");
        form.mount();

        const busy: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading().lock());
                await wait(200);
                return ctx.state.idle().unlock();
            },
        };
        const id = rows.append();
        rows.row(id)?.field("a", { behaviors: [busy] }).mount();
        await wait(20);

        expect(form.isBusy).toBe(true);
    });

    it("une ligne retirée n'influence plus le formulaire", async () => {
        type Fields = { rows: FieldArray<{ label: string }> };
        const form = new FormController<Fields>({ name: "t15" });
        const rows = form.array("rows");
        form.mount();

        const id = rows.append();
        const row = rows.row(id);
        const field = row?.field("label");
        field?.mount();
        field?.change("avant retrait");
        await wait(20);

        rows.remove(id);
        const before = form.snapshot;

        // La ligne vit encore comme objet : on la sollicite directement, sans
        // passer par le champ démonté, pour vérifier que le parent n'écoute plus.
        row?.form.field("label", {});
        row?.form.mount();
        await wait(20);

        expect(form.snapshot).toBe(before);
        expect(form.values()).toEqual({ rows: [] });
    });
});
