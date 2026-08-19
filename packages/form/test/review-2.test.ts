import { describe, expect, it } from "vitest";
import {
    behaviorsFor,
    FormController,
    IValidator,
    ExternalValidator,
    type FieldArray,
    type IBehavior,
    type ValidationReport,
} from "../src/index";
import { until, wait } from "./helpers";

class Passing extends IValidator<string> {
    protected validate(): void {
        // aucune règle
    }
}

describe("second tour de revue", () => {
    it("lookup : une réponse périmée ne gagne pas et ne libère pas le champ", async () => {
        const form = new FormController<{ src: string; city: string }>({ name: "s1" });
        const { lookup } = behaviorsFor(form);
        let call = 0;
        const source = form.field("src", {});
        const city = form.field("city", {
            behaviors: [lookup({
                field: "city",
                watch: ["src"],
                fetch: async () => {
                    call += 1;
                    const mine = call;
                    await wait(mine === 1 ? 20 : 150);
                    return `ville-${mine}`;
                },
            })],
        });
        source.mount();
        city.mount();
        form.mount();

        source.change("a");
        await wait(5);
        source.change("b");
        await wait(60);

        // Le run frais est encore en vol : le champ doit rester occupé.
        expect(city.isBusy).toBe(true);
        expect(city.snapshot.value).toBeUndefined();

        await wait(200);
        expect(city.snapshot.value).toBe("ville-2");
    });

    it("lookup : une instance partagée par deux lignes ne les couple pas", async () => {
        type Row = { code: string; city: string };
        const typing = behaviorsFor(new FormController<Row>({ name: "typage" }));
        let calls = 0;
        const shared = typing.lookup({
            field: "city",
            watch: ["code"],
            debounce: 10,
            fetch: async ({ code }) => {
                calls += 1;
                await wait(10);
                return `ville-${String(code)}`;
            },
        });

        const form = new FormController<{ rows: FieldArray<Row> }>({ name: "s2" });
        const rows = form.array("rows");
        form.mount();

        const first = rows.append();
        const second = rows.append();
        for (const id of [first, second]) {
            rows.row(id)?.field("code").mount();
            rows.row(id)?.field("city", { behaviors: [shared] }).mount();
        }
        rows.row(first)?.field("code").change("75");
        rows.row(second)?.field("code").change("13");
        await until(() => rows.row(second)?.form.get("city")?.snapshot.value !== undefined);

        expect(calls).toBe(2);
        expect(rows.row(first)?.form.get("city")?.snapshot.value).toBe("ville-75");
        expect(rows.row(second)?.form.get("city")?.snapshot.value).toBe("ville-13");
        expect(rows.row(first)?.form.get("city")?.snapshot.isLocked).toBe(false);
    });

    it("reset() recalcule les tranches au lieu de les effacer", async () => {
        const form = new FormController<{ brand: string; other: string }>({ name: "s3" });
        const { hideWhen } = behaviorsFor(form);
        const brand = form.field("brand", {});
        const other = form.field("other", {
            required: true,
            behaviors: [hideWhen({ watch: ["brand"], when: (deps) => deps.brand !== "autre" })],
        });
        brand.mount();
        other.mount();
        form.mount();
        await wait(30);
        expect(other.snapshot.isVisible).toBe(false);
        expect(form.snapshot.isValid).toBe(true);

        form.reset();
        await wait(40);

        // La condition tient toujours : le champ doit rester masqué, donc hors
        // du formulaire — sinon il réapparaît et bloque la soumission.
        expect(other.snapshot.isVisible).toBe(false);
        expect(form.snapshot.isValid).toBe(true);
    });

    it("un constat serveur porte sur un champ obligatoire vide, puis s'efface", async () => {
        const form = new FormController<{ email: string }>({ name: "s4" });
        const serverIssues = new ExternalValidator<string>();
        const field = form.field("email", { required: true, validator: [serverIssues, new Passing()] });
        field.mount();
        form.mount();
        await wait(20);

        serverIssues.set([{ message: "manquant côté serveur", severity: "error", code: "missing" }]);
        await wait(40);
        expect(field.snapshot.errors).toContain("manquant côté serveur");

        // Le constat portait sur ce qui a été envoyé, pas sur la correction.
        field.change("ada@lovelace.dev");
        await wait(40);
        expect(field.snapshot.errors).toEqual([]);
    });

    it("composer deux validators synchrones ne fait pas clignoter loading", async () => {
        const form = new FormController<{ a: string; b: string }>({ name: "s5" });
        const alone = form.field("a", { validator: new Passing() });
        const composed = form.field("b", { validator: [new Passing(), new Passing()] });
        alone.mount();
        composed.mount();
        form.mount();
        await wait(20);

        const seen: string[] = [];
        composed.listen(() => seen.push(composed.snapshot.ui.activity));
        composed.change("x");
        await wait(40);

        expect(seen).not.toContain("loading");
    });

    it("un résultat de validation périmé n'écrase pas un plus frais", async () => {
        const form = new FormController<{ a: string }>({ name: "s6" });
        class Slow extends IValidator<string> {
            protected async validate(value: string, report: ValidationReport): Promise<void> {
                await wait(value === "premier" ? 80 : 10);
                report.errorIf(value === "premier", "verdict périmé");
            }
        }
        const field = form.field("a", { validator: new Slow() });
        field.mount();
        form.mount();

        field.change("premier");
        await wait(5);
        field.change("second");
        await wait(150);

        expect(field.snapshot.errors).toEqual([]);
    });

    it("ctx.setValue ne marque pas le champ touché", async () => {
        const form = new FormController<{ a: string }>({ name: "s7" });
        const writer: IBehavior<string> = { onMount: (ctx) => void ctx.setValue("posée par l'API") };
        const field = form.field("a", { behaviors: [writer] });
        field.mount();
        form.mount();
        await wait(30);

        expect(field.snapshot.value).toBe("posée par l'API");
        expect(field.snapshot.touched).toBe(false);
        expect(field.snapshot.validity).toBe("pristine");
    });

    it("un démontage en vol ne laisse pas la tranche figée", async () => {
        const form = new FormController<{ a: string }>({ name: "s8" });
        const slow: IBehavior<string> = {
            onMount: async (ctx) => {
                ctx.push(ctx.state.loading().lock());
                await wait(200);
                return ctx.state.idle().unlock();
            },
        };
        const field = form.field("a", { behaviors: [slow] });
        field.mount();
        form.mount();
        await wait(20);
        expect(field.snapshot.isLoading).toBe(true);

        field.unmount();
        expect(field.snapshot.isLoading).toBe(false);
        expect(field.snapshot.isLocked).toBe(false);
    });

    it("readOnly piloté par la vue est bien porté", () => {
        const form = new FormController<{ a: string }>({ name: "s9" });
        const field = form.field("a", {});
        field.mount();
        form.mount();

        field.update({ readOnly: true });
        expect(field.snapshot.isReadOnly).toBe(true);
        expect(field.snapshot.isLocked).toBe(false);
    });

    it("les identifiants de ligne ne sont jamais réattribués", () => {
        type Fields = { rows: FieldArray<{ label: string }> };
        const form = new FormController<Fields>({ name: "s10" });
        const rows = form.array("rows");
        form.mount();

        const first = rows.append();
        rows.remove(first);
        const second = rows.append();

        expect(second).not.toBe(first);
    });

    it("chaque modification de composition publie une nouvelle référence", () => {
        type Fields = { rows: FieldArray<{ label: string }> };
        const form = new FormController<Fields>({ name: "s11" });
        const rows = form.array("rows");
        form.mount();

        rows.append();
        const afterFirst = rows.getSnapshot();
        rows.append();
        const afterSecond = rows.getSnapshot();

        expect(afterSecond).not.toBe(afterFirst);
        expect(afterSecond).toHaveLength(2);
    });

    it("quitter un champ tranche tout de suite, sans attendre le délai", async () => {
        const form = new FormController<{ a: string }>({ name: "s12" });
        const { suggest } = behaviorsFor(form);
        let calls = 0;
        const field = form.field("a", {
            behaviors: [suggest({
                field: "a",
                debounce: 300,
                fetch: async () => {
                    calls += 1;
                    return [];
                },
            })],
        });
        field.mount();
        form.mount();

        field.change("ab");
        await wait(20);
        expect(calls).toBe(0);

        await form.submit();
        expect(calls).toBe(1);
    });
});
