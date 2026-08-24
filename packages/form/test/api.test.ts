import { describe, expect, it } from "vitest";
import {
    behaviorsFor,
    ExternalValidator,
    FormController,
    IValidator,
    type IBehavior,
    type ValidationContext,
    type ValidationReport,
} from "../src/index";
import { wait } from "./helpers";

class NonEmpty extends IValidator<string> {
    protected validate(value: string, report: ValidationReport): void {
        report.errorIf(value.trim() === "", "obligatoire");
    }
}

describe("A1 — le validator déclare ses dépendances et lit le formulaire", () => {
    it("reçoit un contexte en lecture et transporte le code du constat", async () => {
        const form = new FormController<{ start: string; end: string }>({ name: "a1" });
        class After extends IValidator<string> {
            override readonly watch = ["start"];
            protected validate(value: string, report: ValidationReport, ctx: ValidationContext): void {
                const start = ctx.watched("start")?.value;
                report.errorIf(typeof start === "string" && value < start, "fin avant début", { code: "order" });
            }
        }
        const start = form.field("start", {});
        const end = form.field("end", { validator: new After() });
        start.mount();
        end.mount();
        form.mount();

        start.change("2026-01-10");
        end.change("2026-01-05");
        await wait(20);

        expect(end.snapshot.ui.validity).toBe("error");
        expect(end.snapshot.issues[0]?.code).toBe("order");
    });

    it("refuse de lire un champ non déclaré dans watch", async () => {
        const form = new FormController<{ a: string; b: string }>({ name: "a1-strict" });
        let thrown: unknown;
        class Sneaky extends IValidator<string> {
            protected validate(_value: string, _report: ValidationReport, ctx: ValidationContext): void {
                try {
                    ctx.watched("a");
                } catch (error) {
                    thrown = error;
                }
            }
        }
        form.field("a", {}).mount();
        const b = form.field("b", { validator: new Sneaky() });
        b.mount();
        form.mount();
        b.change("x");
        await wait(20);

        expect((thrown as Error | undefined)?.message).toMatch(/without declaring it in `watch`/);
    });
});

describe("A2 — constats structurés", () => {
    it("un avertissement remonte sans bloquer la validité", async () => {
        const form = new FormController<{ w: string }>({ name: "a2" });
        class Suspicious extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.warnIf(value.length < 3, "semble court", { code: "short" });
            }
        }
        const field = form.field("w", { validator: new Suspicious() });
        field.mount();
        form.mount();
        field.change("ab");
        await wait(20);

        expect(field.snapshot.warnings).toEqual(["semble court"]);
        expect(field.snapshot.errors).toEqual([]);
        expect(field.snapshot.ui.validity).toBe("valid");
        expect(form.snapshot.hasFlag("valid")).toBe(true);
    });

    it("le code permet de router un constat sans que le moteur en décide", async () => {
        const form = new FormController<{ w: string }>({ name: "a2-code" });
        class Coded extends IValidator<string> {
            protected validate(_value: string, report: ValidationReport): void {
                report.error("à afficher en snackbar", { code: "toast" });
                report.error("à afficher sous le champ", { code: "inline" });
            }
        }
        const field = form.field("w", { validator: new Coded() });
        field.mount();
        form.mount();
        field.change("x");
        await wait(20);

        const byCode = Object.fromEntries(field.snapshot.issues.map((issue) => [issue.code, issue.message]));
        expect(byCode.toast).toBe("à afficher en snackbar");
        expect(byCode.inline).toBe("à afficher sous le champ");
    });
});

describe("A3 — watch avec déclencheurs", () => {
    it("un nom seul ne réagit qu'à la valeur", async () => {
        const form = new FormController<{ src: string; dst: string }>({ name: "a3-default" });
        let woken = 0;
        const counter: IBehavior<string> = {
            watch: ["src"],
            onDependencyChanged: () => {
                woken += 1;
            },
        };
        const src = form.field("src", { validator: new NonEmpty() });
        form.field("dst", { behaviors: [counter] }).mount();
        src.mount();
        form.mount();

        src.blur();
        await wait(20);
        expect(woken).toBe(0);

        src.change("valeur");
        await wait(20);
        expect(woken).toBe(1);
    });

    it("on: [\"validity\"] réveille sur le verdict du voisin", async () => {
        const form = new FormController<{ src: string; dst: string }>({ name: "a3-validity" });
        const { lockUntilValid } = behaviorsFor(form);
        const src = form.field("src", { required: true, validator: new NonEmpty() });
        const dst = form.field("dst", { behaviors: [lockUntilValid({ watch: ["src"] })] });
        src.mount();
        dst.mount();
        form.mount();
        await wait(20);

        expect(dst.snapshot.hasFlag("locked")).toBe(true);

        src.change("rempli");
        await wait(30);
        expect(dst.snapshot.hasFlag("locked")).toBe(false);
    });
});

describe("A4 — composition de validators", () => {
    it("agrège les constats de chaque membre", async () => {
        const form = new FormController<{ code: string }>({ name: "a4" });
        class StartsWith extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(!value.startsWith("CUST-"), "préfixe attendu");
            }
        }
        class LongEnough extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(value.length < 10, "trop court");
            }
        }
        const field = form.field("code", { validator: [new StartsWith(), new LongEnough()] });
        field.mount();
        form.mount();
        field.change("X");
        await wait(20);

        expect(field.snapshot.errors).toEqual(["préfixe attendu", "trop court"]);
    });

    it("une erreur serveur s'injecte puis s'efface à la frappe suivante", async () => {
        const form = new FormController<{ email: string }>({ name: "a4-server" });
        class Mail extends IValidator<string> {
            protected validate(value: string, report: ValidationReport): void {
                report.errorIf(!value.includes("@"), "format invalide");
            }
        }
        const serverIssues = new ExternalValidator<string>();
        const field = form.field("email", { validator: [new Mail(), serverIssues] });
        field.mount();
        form.mount();

        field.change("ada@lovelace.dev");
        await wait(20);
        expect(field.snapshot.ui.validity).toBe("valid");

        serverIssues.set([{ message: "Déjà pris", severity: "error", code: "taken" }]);
        await wait(30);
        expect(field.snapshot.errors).toEqual(["Déjà pris"]);

        field.change("grace@hopper.dev");
        await wait(30);
        expect(field.snapshot.errors).toEqual([]);
    });
});

describe("A5 et A6 — disponibilité", () => {
    it("readonly se cumule sans impliquer locked", async () => {
        const form = new FormController<{ k: string }>({ name: "a5" });
        const readOnly: IBehavior<string> = { onMount: (ctx) => ctx.state.readOnly() };
        const field = form.field("k", { behaviors: [readOnly] });
        field.mount();
        form.mount();
        await wait(10);

        expect(field.snapshot.hasFlag("readonly")).toBe(true);
        expect(field.snapshot.hasFlag("locked")).toBe(false);
    });

    it("la vue peut verrouiller, et effacer une valeur qu'elle pilote", () => {
        const form = new FormController<{ v: string }>({ name: "a6" });
        const field = form.field("v", { initialValue: "x" });
        field.mount();
        form.mount();

        field.update({ locked: true });
        expect(field.snapshot.hasFlag("locked")).toBe(true);

        field.update({ value: undefined });
        expect(field.snapshot.value).toBeUndefined();
    });

    it("ne pas passer `value` laisse le champ libre", () => {
        const form = new FormController<{ v: string }>({ name: "a6-libre" });
        const field = form.field("v", { initialValue: "posée" });
        field.mount();
        form.mount();

        field.update({ required: true });
        expect(field.snapshot.value).toBe("posée");
    });
});
