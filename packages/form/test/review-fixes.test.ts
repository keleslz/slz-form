import { describe, expect, it } from "vitest";
import {
    behaviorsFor,
    DebouncedValidator,
    ExternalValidator,
    FormController,
    IValidator,
    type FieldArray,
    type FieldOption,
    type IBehavior,
    type ValidationReport,
} from "../src/index";
import { wait } from "./helpers";

/** Signale toujours, y compris sur une valeur vide. */
class AlwaysFails extends IValidator<string> {
    override readonly validateWhenEmpty = true;
    protected validate(_value: string, report: ValidationReport): void {
        report.error("règle violée");
    }
}

class Noop extends IValidator<string> {
    protected validate(): void {
        // aucune règle
    }
}

describe("constats de revue", () => {
    it("composer un validator ne lui retire pas validateWhenEmpty", async () => {
        const form = new FormController<{ a: string }>({ name: "r1" });
        const field = form.field("a", { validator: [new AlwaysFails(), new Noop()] });
        field.mount();
        form.mount();
        await wait(30);

        expect(field.snapshot.errors).toEqual(["règle violée"]);
    });

    it("différer un validator ne lui retire pas validateWhenEmpty", async () => {
        const form = new FormController<{ a: string }>({ name: "r2" });
        const field = form.field("a", { validator: new DebouncedValidator(new AlwaysFails(), 5) });
        field.mount();
        form.mount();
        field.blur();
        await wait(60);

        expect(field.snapshot.errors).toEqual(["règle violée"]);
    });

    it("un cycle démontage/remontage ne rend pas les erreurs serveur muettes", async () => {
        const form = new FormController<{ email: string }>({ name: "r3" });
        class Mail extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(!value.includes("@"), "format");
            }
        }
        const serverIssues = new ExternalValidator<string>();
        const field = form.field("email", { validator: [new Mail(), serverIssues] });

        // Ce que React fait en StrictMode.
        field.mount();
        field.unmount();
        field.mount();
        form.mount();

        field.change("ada@lovelace.dev");
        await wait(20);
        serverIssues.set([{ message: "Déjà pris", severity: "error" }]);
        await wait(40);

        expect(field.snapshot.errors).toEqual(["Déjà pris"]);
    });

    it("un constat serveur porte aussi sur un champ vide", async () => {
        const form = new FormController<{ v: string }>({ name: "r4" });
        const serverIssues = new ExternalValidator<string>();
        const field = form.field("v", { validator: [serverIssues, new Noop()] });
        field.mount();
        form.mount();

        serverIssues.set([{ message: "champ manquant côté serveur", severity: "error" }]);
        await wait(40);

        expect(field.snapshot.errors).toEqual(["champ manquant côté serveur"]);
    });

    it("reset() ne déclare pas valide un champ obligatoire redevenu vide", async () => {
        const form = new FormController<{ r: string }>({ name: "r5" });
        form.field("r", { required: true }).mount();
        form.mount();
        await wait(20);
        expect(form.snapshot.isValid).toBe(false);

        form.reset();
        await wait(30);
        expect(form.snapshot.isValid).toBe(false);
    });

    it("lockUntilValid ne verrouille pas un champ prérempli et correct", async () => {
        const form = new FormController<{ src: string; dst: string }>({ name: "r6" });
        const { lockUntilValid } = behaviorsFor(form);
        const src = form.field("src", { required: true, initialValue: "déjà rempli" });
        const dst = form.field("dst", { behaviors: [lockUntilValid({ watch: ["src"] })] });
        src.mount();
        dst.mount();
        form.mount();
        await wait(40);

        expect(src.snapshot.validity).toBe("pristine");
        expect(src.snapshot.isBlocking).toBe(false);
        expect(dst.snapshot.isLocked).toBe(false);
    });

    it("un fan-out large n'est pas confondu avec une boucle", async () => {
        const form = new FormController<Record<string, string>>({ name: "r7" });
        const source = form.field("src", {});
        for (let index = 0; index < 120; index += 1) {
            const observer: IBehavior<string> = {
                watch: ["src"],
                onDependencyChanged: (ctx, dependency) => {
                    ctx.setValue(`o${index}:${String(dependency.value)}`);
                },
            };
            form.field(`o${index}`, { behaviors: [observer] }).mount();
        }
        source.mount();
        form.mount();

        expect(() => source.change("x")).not.toThrow();
        await wait(30);
        expect(form.get("o119")?.snapshot.value).toBe("o119:x");
    });

    it("une instance de behavior partagée par deux lignes ne les couple pas", async () => {
        type Row = { city: string };
        type Fields = { rows: FieldArray<Row> };
        const { loadOptions } = behaviorsFor(new FormController<{ city: string }>({ name: "typing" }));
        let calls = 0;
        const shared = loadOptions({
            field: "city",
            fetch: async () => {
                calls += 1;
                const mine = calls;
                await wait(10);
                return [{ value: `r${mine}`, label: `R${mine}` }] as FieldOption<string>[];
            },
        });

        const form = new FormController<Fields>({ name: "r8" });
        const rows = form.array("rows");
        form.mount();

        const a = rows.append();
        const b = rows.append();
        rows.row(a)?.field("city", { behaviors: [shared] }).mount();
        rows.row(b)?.field("city", { behaviors: [shared] }).mount();
        await wait(80);

        expect(calls).toBe(2);
        for (const id of [a, b]) {
            const field = rows.row(id)?.form.get("city");
            expect(field?.snapshot.options).toHaveLength(1);
            expect(field?.snapshot.isLocked).toBe(false);
        }
    });

    it("form.mount() remonte les champs que form.unmount() a démontés", async () => {
        const form = new FormController<{ a: string }>({ name: "r9" });
        const field = form.field("a", {});
        field.mount();
        form.mount();
        field.change("Ada");

        form.unmount();
        form.mount();
        await wait(20);

        expect(form.values()).toEqual({ a: "Ada" });
    });

    it("reset() vide la liste, qui naît vide", () => {
        type Fields = { rows: FieldArray<{ label: string }> };
        const form = new FormController<Fields>({ name: "r10" });
        const rows = form.array("rows");
        form.mount();

        rows.append();
        rows.append();
        expect(rows.rows).toHaveLength(2);

        form.reset();
        expect(rows.rows).toHaveLength(0);
    });

    it("plusieurs déclarations du même champ observé comptent toutes", async () => {
        const form = new FormController<{ src: string; dst: string }>({ name: "r11" });
        const seen: string[] = [];
        const observer: IBehavior<string> = {
            watch: [
                { field: "src", on: ["value"] },
                { field: "src", on: ["validity"] },
            ],
            onDependencyChanged: (_ctx, dependency) => {
                seen.push(String(dependency.validity));
            },
        };
        class NonEmpty extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(value.trim() === "", "vide");
            }
        }
        const src = form.field("src", { validator: new NonEmpty() });
        form.field("dst", { behaviors: [observer] }).mount();
        src.mount();
        form.mount();

        src.change("rempli");
        await wait(40);

        expect(seen.length).toBeGreaterThan(0);
    });

    it("un `on` vide est refusé au câblage plutôt qu'ignoré", () => {
        const form = new FormController<{ src: string; dst: string }>({ name: "r12" });
        form.field("src", {});

        expect(() => form.field("dst", {
            behaviors: [{ watch: [{ field: "src", on: [] }], onDependencyChanged: () => undefined }],
        })).toThrow(/empty `on`/);
    });

    it("l'ancienne lecture `getState().errors` fonctionne encore", async () => {
        const form = new FormController<{ a: string }>({ name: "r13" });
        const validator = new AlwaysFails();
        form.field("a", { validator }).mount();
        form.mount();
        await wait(20);

        expect(validator.getState().errors).toEqual(["règle violée"]);
    });

    it("handle() reste appelable sans contexte", async () => {
        const validator = new AlwaysFails();
        const state = await validator.handle("x");
        expect(state.errors).toEqual(["règle violée"]);
    });
});
