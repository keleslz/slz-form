import { describe, expect, it } from "vitest";
import {
    FormController,
    IValidator,
    type FieldArray,
    type ValidationContext,
    type ValidationReport,
} from "../src/index";
import { wait } from "./helpers";

type InvoiceLine = { label: string; qty: number };
type InvoiceFields = { customer: string; lines: FieldArray<InvoiceLine> };

const buildInvoice = (name: string): FormController<InvoiceFields> =>
    new FormController<InvoiceFields>({ name });

describe("champs répétables", () => {
    it("une ligne est un formulaire : mêmes appels, même typage", () => {
        const form = buildInvoice("fa1");
        const lines = form.array("lines");
        form.mount();

        const id = lines.append();
        const row = lines.row(id);
        row?.field("label").mount();
        row?.field("qty").mount();
        row?.field("label").change("Prestation");
        row?.field("qty").change(3);

        expect(lines.rows).toHaveLength(1);
        expect(row?.values()).toEqual({ label: "Prestation", qty: 3 });
    });

    it("les identifiants sont stables : supprimer une ligne n'en renomme aucune", () => {
        const form = buildInvoice("fa2");
        const lines = form.array("lines");
        form.mount();

        const first = lines.append();
        const second = lines.append();
        const third = lines.append();
        lines.row(second)?.field("label").mount();
        lines.row(second)?.field("label").change("B");

        lines.remove(first);

        expect(lines.rows.map((row) => row.id)).toEqual([second, third]);
        expect(lines.row(second)?.values().label).toBe("B");
    });

    it("réordonner ne change que l'ordre, jamais les identités", () => {
        const form = buildInvoice("fa3");
        const lines = form.array("lines");
        form.mount();

        const a = lines.append();
        const b = lines.append();
        lines.row(a)?.field("label").mount();
        lines.row(b)?.field("label").mount();
        lines.row(a)?.field("label").change("A");
        lines.row(b)?.field("label").change("B");

        lines.move(0, 1);

        expect(lines.rows.map((row) => row.id)).toEqual([b, a]);
        expect(lines.row(a)?.values().label).toBe("A");
    });

    it("le payload du formulaire imbrique les lignes dans l'ordre affiché", () => {
        const form = buildInvoice("fa4");
        const lines = form.array("lines");
        form.field("customer").mount();
        form.field("customer").change("Ada");
        form.mount();

        const first = lines.append();
        const second = lines.append();
        lines.row(first)?.field("label").mount();
        lines.row(second)?.field("label").mount();
        lines.row(first)?.field("label").change("Un");
        lines.row(second)?.field("label").change("Deux");
        lines.move(0, 1);

        expect(form.values()).toEqual({
            customer: "Ada",
            lines: [{ label: "Deux" }, { label: "Un" }],
        });
    });

    it("une ligne invalide rend le formulaire invalide et bloque la soumission", async () => {
        const form = buildInvoice("fa5");
        const lines = form.array("lines");
        form.field("customer").mount();
        form.mount();

        const id = lines.append();
        lines.row(id)?.field("label", { required: true }).mount();
        await wait(20);

        expect(form.snapshot.isValid).toBe(false);
        await expect(form.submit()).resolves.toBe(false);

        lines.row(id)?.field("label").change("Prestation");
        await wait(20);
        expect(form.snapshot.isValid).toBe(true);
    });

    it("retirer la ligne fautive rend le formulaire soumettable", async () => {
        const form = buildInvoice("fa6");
        const lines = form.array("lines");
        form.mount();

        const id = lines.append();
        lines.row(id)?.field("label", { required: true }).mount();
        await wait(20);
        expect(form.snapshot.isValid).toBe(false);

        lines.remove(id);
        await wait(20);
        expect(form.snapshot.isValid).toBe(true);
    });

    it("une règle inter-lignes s'écrit dans un validator du parent, via son watch", async () => {
        type Split = { share: number };
        type Deal = { total: string; parts: FieldArray<Split> };

        class SharesMakeAHundred extends IValidator<string> {
            override readonly watch = ["parts"];
            override readonly validateWhenEmpty = true;

            protected validate(_value: string, report: ValidationReport, ctx: ValidationContext): void {
                const parts = ctx.form.values().parts;
                if (!Array.isArray(parts) || parts.length === 0) {
                    return;
                }
                const sum = parts.reduce<number>(
                    (acc, part) => acc + Number((part as { share?: number }).share ?? 0),
                    0,
                );
                report.errorIf(sum !== 100, `la somme fait ${sum}, pas 100`, { code: "sum" });
            }
        }

        const form = new FormController<Deal>({ name: "fa7" });
        const parts = form.array("parts");
        const total = form.field("total", { validator: new SharesMakeAHundred() });
        total.mount();
        form.mount();

        const a = parts.append();
        const b = parts.append();
        parts.row(a)?.field("share").mount();
        parts.row(b)?.field("share").mount();
        parts.row(a)?.field("share").change(60);
        parts.row(b)?.field("share").change(30);
        await total.validateNow();

        expect(total.snapshot.errors[0]).toBe("la somme fait 90, pas 100");

        parts.row(b)?.field("share").change(40);
        await total.validateNow();
        expect(total.snapshot.errors).toEqual([]);
    });

    it("la liste publie une nouvelle référence à chaque modification de composition", () => {
        const form = buildInvoice("fa8");
        const lines = form.array("lines");
        form.mount();

        const before = lines.getSnapshot();
        lines.append();
        expect(lines.getSnapshot()).not.toBe(before);
    });
});
